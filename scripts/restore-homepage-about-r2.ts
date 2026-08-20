import { createHash } from "crypto";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

loadEnvConfig(process.cwd());

const EXPECTED_R2_BUCKET = "turkuvaz-insaat";
const OLD_R2_PUBLIC_URL = "https://pub-4ee483fa5b544b4e86ba1ca3e49e47ec.r2.dev";
const NEW_R2_PUBLIC_URL = "https://cdn.turkuvazinsaat.com";
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const EXPECTED_ABOUT_MD5 = "1930e91a5186fdd6d15c4f4bef096386";
const WRITE_FLAGS = new Set(["--execute"]);
const FORBIDDEN_FLAGS = new Set(["--write", "--apply", "--fix", "--restore", "--force"]);

type Mode = "dry-run" | "execute";
type Classification = "RESTORE_SAFE" | "UNRESOLVED" | "EXACT_MATCH";
type ItemKind = "HomepageHero" | "AboutPage";
type VariantRole = "original" | "web" | "thumbnail";

type LocalFile = {
  relativePath: string;
  absolutePath: string;
  size: number;
  md5: string;
  sha256: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

type MediaItem = {
  kind: ItemKind;
  id: string;
  fields: Record<string, string | null | undefined>;
  metadata: {
    fileSize?: number | null;
    width?: number | null;
    height?: number | null;
    mimeType?: string | null;
  };
};

type PlannedObject = {
  key: string;
  role: VariantRole;
  contentType: string;
  exists: boolean;
};

type ItemPlan = {
  item: MediaItem;
  classification: Classification;
  dbKeys: string[];
  evidence: string[];
  matchedLocalFiles: LocalFile[];
  plannedObjects: PlannedObject[];
};

type UploadResult = {
  key: string;
  status: "uploaded" | "skipped-existing" | "failed";
  error?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseMode(): Mode {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (WRITE_FLAGS.has(arg)) continue;
    if (FORBIDDEN_FLAGS.has(arg) || arg.startsWith("--")) {
      throw new Error(`Unknown or forbidden flag: ${arg}. Only --execute is accepted.`);
    }
  }
  return args.includes("--execute") ? "execute" : "dry-run";
}

function requireProductionEnvironment(): { databaseUrl: string; bucketName: string } {
  const databaseUrl = requiredEnv("DATABASE_URL");
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("DATABASE_URL must be a PostgreSQL URL for the Turkuvaz production database. SQLite is refused.");
  }

  const bucketName = requiredEnv("CLOUDFLARE_R2_BUCKET_NAME");
  if (bucketName !== EXPECTED_R2_BUCKET) {
    throw new Error(`Refusing bucket "${bucketName}". Expected "${EXPECTED_R2_BUCKET}" only.`);
  }

  return { databaseUrl, bucketName };
}

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv("CLOUDFLARE_R2_ENDPOINT"),
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
}

function safeDatabaseDescription(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  if (parsed.username) parsed.username = "<user>";
  if (parsed.password) parsed.password = "<password>";
  return parsed.toString();
}

function extensionMimeType(filePath: string): string | undefined {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return undefined;
}

function sharpMimeType(format?: keyof sharp.FormatEnum): string | undefined {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return undefined;
}

function extractR2Key(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    const knownHost = parsed.hostname.endsWith(".r2.dev") || parsed.origin === OLD_R2_PUBLIC_URL || parsed.origin === NEW_R2_PUBLIC_URL;
    if (!knownHost) return undefined;
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || undefined;
  } catch {
    const relativeKey = trimmed.replace(/^\/+/, "");
    if (/^images\//.test(relativeKey)) return decodeURIComponent(relativeKey);
    return undefined;
  }
}

function dbKeysForItem(item: MediaItem): string[] {
  return [...new Set(Object.values(item.fields).map(extractR2Key).filter((key): key is string => Boolean(key)))].sort();
}

function plannedObjectsForItem(item: MediaItem, existingKeys: Set<string>): PlannedObject[] {
  const objects = new Map<string, PlannedObject>();
  const add = (field: string, role: VariantRole, contentType: string) => {
    const key = extractR2Key(item.fields[field]);
    if (!key || objects.has(key)) return;
    objects.set(key, { key, role, contentType, exists: existingKeys.has(key) });
  };

  add("imageOriginalUrl", "original", item.metadata.mimeType ?? "application/octet-stream");
  add("imageWebUrl", "web", "image/webp");
  add("imageUrl", "web", "image/webp");
  add("imageThumbnailUrl", "thumbnail", "image/webp");
  return [...objects.values()].sort((a, b) => a.key.localeCompare(b.key));
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await task(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return walkFiles(fullPath);
      if (entry.isFile()) return [fullPath];
      return [];
    }),
  );
  return nested.flat();
}

async function inspectLocalFile(filePath: string): Promise<LocalFile> {
  const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
  let width: number | undefined;
  let height: number | undefined;
  let mimeType = extensionMimeType(filePath);

  if (mimeType?.startsWith("image/")) {
    try {
      const metadata = await sharp(buffer, { animated: false }).metadata();
      width = metadata.width;
      height = metadata.height;
      mimeType = sharpMimeType(metadata.format) ?? mimeType;
    } catch {
      // Invalid images will not be eligible for restore; hashes still help diagnostics.
    }
  }

  return {
    relativePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    absolutePath: filePath,
    size: fileStat.size,
    md5: createHash("md5").update(buffer).digest("hex"),
    sha256: createHash("sha256").update(buffer).digest("hex"),
    width,
    height,
    mimeType,
  };
}

async function inspectLocalUploads(): Promise<LocalFile[]> {
  const uploadStat = await stat(LOCAL_UPLOADS_DIR).catch(() => null);
  if (!uploadStat?.isDirectory()) return [];
  return mapLimit(await walkFiles(LOCAL_UPLOADS_DIR), 8, inspectLocalFile);
}

function metadataMatches(item: MediaItem, file: LocalFile): boolean {
  const metadata = item.metadata;
  if (metadata.fileSize != null && metadata.fileSize !== file.size) return false;
  if (metadata.width != null && metadata.width !== file.width) return false;
  if (metadata.height != null && metadata.height !== file.height) return false;
  if (metadata.mimeType && file.mimeType && metadata.mimeType.toLowerCase() !== file.mimeType.toLowerCase()) return false;
  return true;
}

function uniqueContentGroups(files: LocalFile[]): LocalFile[][] {
  const groups = new Map<string, LocalFile[]>();
  for (const file of files) {
    const key = `${file.md5}:${file.sha256}`;
    const group = groups.get(key) ?? [];
    group.push(file);
    groups.set(key, group);
  }
  return [...groups.values()];
}

async function objectExists(client: S3Client, bucketName: string, key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const name = (error as { name?: string }).name;
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return false;
    throw error;
  }
}

async function buildExistingKeySet(client: S3Client, bucketName: string, keys: string[]): Promise<Set<string>> {
  const uniqueKeys = [...new Set(keys)].sort();
  const pairs = await mapLimit(uniqueKeys, 12, async (key) => [key, await objectExists(client, bucketName, key)] as const);
  return new Set(pairs.filter(([, exists]) => exists).map(([key]) => key));
}

function classifyAboutPage(item: MediaItem, localFiles: LocalFile[], existingKeys: Set<string>): ItemPlan {
  const dbKeys = dbKeysForItem(item);
  const plannedObjects = plannedObjectsForItem(item, existingKeys);
  const missingObjects = plannedObjects.filter((object) => !object.exists);
  const matches = localFiles.filter((file) => metadataMatches(item, file));
  const contentGroups = uniqueContentGroups(matches);
  const evidence = [
    `Production metadata: fileSize=${item.metadata.fileSize}, width=${item.metadata.width}, height=${item.metadata.height}, mimeType=${item.metadata.mimeType}.`,
    `Local metadata matches: ${matches.length}. Unique byte-content groups: ${contentGroups.length}.`,
  ];

  if (contentGroups.length === 1) {
    const group = contentGroups[0].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const first = group[0];
    evidence.push(`All matching local files share MD5 ${first.md5} and SHA-256 ${first.sha256}.`);
    if (first.md5 === EXPECTED_ABOUT_MD5) evidence.push("MD5 matches the previously verified AboutPage source hash.");
    return {
      item,
      classification: missingObjects.length === 0 ? "EXACT_MATCH" : "RESTORE_SAFE",
      dbKeys,
      evidence,
      matchedLocalFiles: group,
      plannedObjects,
    };
  }

  evidence.push(contentGroups.length === 0 ? "No exact local metadata match was found." : "Multiple distinct local byte contents match metadata.");
  return { item, classification: "UNRESOLVED", dbKeys, evidence, matchedLocalFiles: matches, plannedObjects };
}

function classifyHomepageHero(item: MediaItem, localFiles: LocalFile[], existingKeys: Set<string>): ItemPlan {
  const dbKeys = dbKeysForItem(item);
  const plannedObjects = plannedObjectsForItem(item, existingKeys);
  const likelyCandidates = localFiles
    .filter((file) => /(?:ai|hero|son)/i.test(file.relativePath) && file.mimeType?.startsWith("image/"))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    item,
    classification: plannedObjects.every((object) => object.exists) ? "EXACT_MATCH" : "UNRESOLVED",
    dbKeys,
    evidence: [
      "HomepageHero has no stored image fileSize, width, height, MIME, MD5, or SHA-256 metadata in the current schema.",
      "Historical SQLite contains the same old R2 keys but no additional image metadata.",
      "App defaults and filenames are useful hints, but they are not deterministic evidence for the old R2 UUIDs.",
      `Best local candidates by filename/default hints: ${likelyCandidates
        .slice(0, 8)
        .map((file) => `${file.relativePath} (${file.width ?? "?"}x${file.height ?? "?"}, ${file.size} bytes, md5 ${file.md5})`)
        .join("; ") || "none"}.`,
    ],
    matchedLocalFiles: [],
    plannedObjects,
  };
}

async function readMediaItems(prisma: PrismaClient): Promise<MediaItem[]> {
  const [hero, about] = await Promise.all([
    prisma.homepageHero.findUnique({ where: { id: "homepage" } }),
    prisma.aboutPage.findUnique({ where: { id: "about" } }),
  ]);

  const items: MediaItem[] = [];
  if (hero) {
    items.push({
      kind: "HomepageHero",
      id: hero.id,
      fields: {
        imageUrl: hero.imageUrl,
        imageOriginalUrl: hero.imageOriginalUrl,
        imageWebUrl: hero.imageWebUrl,
        imageThumbnailUrl: hero.imageThumbnailUrl,
      },
      metadata: {},
    });
  }

  if (about) {
    items.push({
      kind: "AboutPage",
      id: about.id,
      fields: {
        imageUrl: about.imageUrl,
        imageOriginalUrl: about.imageOriginalUrl,
        imageWebUrl: about.imageWebUrl,
        imageThumbnailUrl: about.imageThumbnailUrl,
      },
      metadata: {
        fileSize: about.imageFileSize,
        width: about.imageWidth,
        height: about.imageHeight,
        mimeType: about.imageMimeType,
      },
    });
  }

  return items;
}

async function revalidateSource(item: MediaItem, file: LocalFile): Promise<Buffer> {
  const buffer = await readFile(file.absolutePath);
  const metadata = await sharp(buffer, { failOn: "error" }).metadata();
  const actualMimeType = sharpMimeType(metadata.format) ?? extensionMimeType(file.absolutePath);

  if (item.metadata.fileSize != null && item.metadata.fileSize !== buffer.length) throw new Error(`File size changed for ${file.relativePath}`);
  if (item.metadata.width != null && item.metadata.width !== metadata.width) throw new Error(`Width changed for ${file.relativePath}`);
  if (item.metadata.height != null && item.metadata.height !== metadata.height) throw new Error(`Height changed for ${file.relativePath}`);
  if (item.metadata.mimeType && actualMimeType && item.metadata.mimeType.toLowerCase() !== actualMimeType.toLowerCase()) {
    throw new Error(`MIME type changed for ${file.relativePath}`);
  }

  return buffer;
}

async function buildVariantBuffers(originalBuffer: Buffer): Promise<Record<VariantRole, Buffer>> {
  const web = await sharp(originalBuffer, { failOn: "error" })
    .rotate()
    .resize({ width: 2400, withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
  const thumbnail = await sharp(originalBuffer, { failOn: "error" })
    .rotate()
    .resize({ width: 720, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  return { original: originalBuffer, web, thumbnail };
}

async function uploadMissingObject(client: S3Client, bucketName: string, object: PlannedObject, body: Buffer): Promise<UploadResult> {
  try {
    if (await objectExists(client, bucketName, object.key)) return { key: object.key, status: "skipped-existing" };

    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: object.key,
        Body: body,
        ContentType: object.contentType,
        CacheControl: "public, max-age=31536000, immutable",
        IfNoneMatch: "*",
      }),
    );
    return { key: object.key, status: "uploaded" };
  } catch (error) {
    return { key: object.key, status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
}

function printPlan(plan: ItemPlan): void {
  console.log(`\n${plan.item.kind}:`);
  console.log(`classification: ${plan.classification}`);
  console.log(`DB keys: ${plan.dbKeys.length ? plan.dbKeys.join(", ") : "none"}`);
  console.log(
    `matched local source: ${
      plan.matchedLocalFiles.length ? plan.matchedLocalFiles.map((file) => file.relativePath).join(" | ") : "none"
    }`,
  );
  console.log("evidence:");
  for (const item of plan.evidence) console.log(`- ${item}`);
  console.log("planned objects to upload:");
  const missing = plan.plannedObjects.filter((object) => !object.exists);
  if (missing.length === 0) {
    console.log("- none");
  } else {
    for (const object of missing) console.log(`- ${object.role}: ${object.key} (${object.contentType})`);
  }
}

async function main(): Promise<void> {
  const mode = parseMode();
  const { databaseUrl, bucketName } = requireProductionEnvironment();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const r2 = getR2Client();

  console.log(`HomepageHero/AboutPage R2 restore (${mode === "execute" ? "EXECUTE" : "DRY RUN"})`);
  console.log(`Database: ${safeDatabaseDescription(databaseUrl)}`);
  console.log(`R2 bucket: ${bucketName}`);
  console.log("Scope: HomepageHero and AboutPage only");
  console.log("Database writes: disabled");
  console.log("R2 deletes: disabled");

  try {
    const [items, localFiles] = await Promise.all([readMediaItems(prisma), inspectLocalUploads()]);
    const allKeys = items.flatMap(dbKeysForItem);
    const existingKeys = await buildExistingKeySet(r2, bucketName, allKeys);
    const plans = items.map((item) =>
      item.kind === "AboutPage" ? classifyAboutPage(item, localFiles, existingKeys) : classifyHomepageHero(item, localFiles, existingKeys),
    );

    for (const plan of plans) printPlan(plan);

    const executablePlans = plans.filter((plan) => plan.classification === "RESTORE_SAFE");
    const plannedObjects = executablePlans.flatMap((plan) => plan.plannedObjects.filter((object) => !object.exists));
    const existingObjects = plans.flatMap((plan) => plan.plannedObjects.filter((object) => object.exists));
    const unresolvedItems = plans.filter((plan) => plan.classification === "UNRESOLVED");

    if (mode === "execute") {
      const uploadResults: UploadResult[] = [];
      for (const plan of executablePlans) {
        const source = plan.matchedLocalFiles[0];
        if (!source) continue;
        try {
          const sourceBuffer = await revalidateSource(plan.item, source);
          const variantBuffers = await buildVariantBuffers(sourceBuffer);
          for (const object of plan.plannedObjects.filter((plannedObject) => !plannedObject.exists)) {
            uploadResults.push(await uploadMissingObject(r2, bucketName, object, variantBuffers[object.role]));
          }
        } catch (error) {
          uploadResults.push({
            key: `${plan.item.kind}:${plan.item.id}:source`,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      console.log("\nExecute summary");
      console.log(`uploaded objects: ${uploadResults.filter((result) => result.status === "uploaded").length}`);
      console.log(`skipped existing objects: ${uploadResults.filter((result) => result.status === "skipped-existing").length}`);
      console.log(`failed objects: ${uploadResults.filter((result) => result.status === "failed").length}`);
      for (const failure of uploadResults.filter((result) => result.status === "failed")) {
        console.log(`- FAILED ${failure.key}: ${failure.error}`);
      }
      console.log("Database writes: 0");
      console.log("R2 deletes: 0");
      return;
    }

    console.log("\nSummary");
    console.log(`HomepageHero RESTORE_SAFE: ${plans.some((plan) => plan.item.kind === "HomepageHero" && plan.classification === "RESTORE_SAFE")}`);
    console.log(`AboutPage RESTORE_SAFE: ${plans.some((plan) => plan.item.kind === "AboutPage" && plan.classification === "RESTORE_SAFE")}`);
    console.log(`Unresolved items: ${unresolvedItems.map((plan) => plan.item.kind).join(", ") || "none"}`);
    console.log(`Objects already existing: ${existingObjects.length}`);
    console.log(`Objects planned for upload: ${plannedObjects.length}`);
    console.log("Database writes: 0");
    console.log("R2 deletes: 0");
    console.log("R2 uploads: 0");
  } finally {
    await prisma.$disconnect();
    r2.destroy();
  }
}

main().catch((error) => {
  console.error("HomepageHero/AboutPage restore failed.");
  console.error("Database writes: 0");
  console.error("R2 deletes: 0");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
