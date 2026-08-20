import { createHash } from "crypto";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

loadEnvConfig(process.cwd());

const EXPECTED_R2_BUCKET = "turkuvaz-insaat";
const OLD_R2_PUBLIC_URL = "https://pub-4ee483fa5b544b4e86ba1ca3e49e47ec.r2.dev";
const NEW_R2_PUBLIC_URL = "https://cdn.turkuvazinsaat.com";
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const WRITE_FLAGS = new Set(["--execute"]);
const FORBIDDEN_WRITE_FLAGS = new Set(["--write", "--apply", "--fix", "--restore", "--force"]);

type Mode = "dry-run" | "execute";
type Classification = "EXACT_MATCH" | "REMAP_SAFE" | "RESTORE_SAFE" | "UNRESOLVED";
type VariantRole = "original" | "web" | "thumbnail";
type R2Group = "images/originals/" | "images/web/" | "images/thumbnails/" | "project-videos/" | "uploads/" | "other";

type ProjectImageRow = {
  id: string;
  url: string;
  originalUrl: string | null;
  webUrl: string | null;
  thumbnailUrl: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  sortOrder: number;
  createdAt: Date;
  project: {
    slug: string;
    title: string;
    titleTr: string | null;
    titleEn: string | null;
  };
};

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

type R2Object = {
  key: string;
  size: number;
  etag?: string;
  lastModified?: Date;
  group: R2Group;
};

type ImageTrio = {
  original: R2Object;
  web: R2Object;
  thumbnail: R2Object;
  localMatches: LocalFile[];
};

type PlannedObject = {
  key: string;
  role: VariantRole;
  contentType: string;
  exists: boolean;
};

type RowPlan = {
  row: ProjectImageRow;
  classification: Classification;
  localMatches: LocalFile[];
  missingKeys: string[];
  plannedObjects: PlannedObject[];
  excludedReason?: string;
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
    if (FORBIDDEN_WRITE_FLAGS.has(arg) || arg.startsWith("--")) {
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

function normalizeEtag(etag?: string): string | undefined {
  const normalized = etag?.replace(/^"|"$/g, "").toLowerCase();
  if (!normalized || normalized.includes("-")) return undefined;
  return normalized;
}

function r2GroupForKey(key: string): R2Group {
  if (key.startsWith("images/originals/")) return "images/originals/";
  if (key.startsWith("images/web/")) return "images/web/";
  if (key.startsWith("images/thumbnails/")) return "images/thumbnails/";
  if (key.startsWith("project-videos/")) return "project-videos/";
  if (key.startsWith("uploads/")) return "uploads/";
  return "other";
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

function tryExtractR2Key(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    const knownHost =
      parsed.hostname.endsWith(".r2.dev") || parsed.origin === OLD_R2_PUBLIC_URL || parsed.origin === NEW_R2_PUBLIC_URL;
    if (!knownHost) return undefined;
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || undefined;
  } catch {
    const relativeKey = trimmed.replace(/^\/+/, "");
    if (/^(images\/|uploads\/)/.test(relativeKey)) return decodeURIComponent(relativeKey);
    return undefined;
  }
}

function projectLabel(row: ProjectImageRow): string {
  return `${row.project.slug} / ${row.project.titleTr ?? row.project.titleEn ?? row.project.title}`;
}

function uniqueDbKeys(row: ProjectImageRow): string[] {
  return [
    ...new Set(
      [row.originalUrl, row.webUrl, row.thumbnailUrl, row.url]
        .map(tryExtractR2Key)
        .filter((key): key is string => Boolean(key)),
    ),
  ].sort();
}

function plannedRoles(row: ProjectImageRow, existingKeys: Set<string>): PlannedObject[] {
  const objects = new Map<string, PlannedObject>();
  const add = (url: string | null | undefined, role: VariantRole, contentType: string) => {
    const key = tryExtractR2Key(url);
    if (!key) return;
    if (objects.has(key)) return;
    objects.set(key, {
      key,
      role,
      contentType,
      exists: existingKeys.has(key),
    });
  };

  add(row.originalUrl, "original", row.mimeType ?? "application/octet-stream");
  add(row.webUrl, "web", "image/webp");
  add(row.url, "web", "image/webp");
  add(row.thumbnailUrl, "thumbnail", "image/webp");
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

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) return walkFiles(fullPath);
      if (entry.isFile()) return [fullPath];
      return [];
    }),
  );
  return files.flat();
}

async function inspectLocalFile(filePath: string): Promise<LocalFile> {
  const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
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
      // Hash and file size are still useful; invalid images will fail revalidation before upload.
    }
  }

  return {
    relativePath,
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

function indexByMd5(localFiles: LocalFile[]): Map<string, LocalFile[]> {
  const index = new Map<string, LocalFile[]>();
  for (const file of localFiles) {
    const matches = index.get(file.md5) ?? [];
    matches.push(file);
    index.set(file.md5, matches);
  }
  return index;
}

async function listR2Objects(client: S3Client, bucketName: string): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucketName, ContinuationToken: continuationToken }));
    for (const item of page.Contents ?? []) {
      if (!item.Key) continue;
      objects.push({
        key: item.Key,
        size: item.Size ?? 0,
        etag: normalizeEtag(item.ETag),
        lastModified: item.LastModified,
        group: r2GroupForKey(item.Key),
      });
    }
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

function associateImageTrios(r2Objects: R2Object[], localByMd5: Map<string, LocalFile[]>): ImageTrio[] {
  const originals = r2Objects.filter((object) => object.group === "images/originals/" && object.lastModified);
  const imageObjectsByTime = r2Objects
    .filter((object) => object.group.startsWith("images/") && object.lastModified)
    .sort((a, b) => (a.lastModified?.getTime() ?? 0) - (b.lastModified?.getTime() ?? 0));
  const trios: ImageTrio[] = [];

  for (const original of originals.sort((a, b) => (a.lastModified?.getTime() ?? 0) - (b.lastModified?.getTime() ?? 0))) {
    const originalTime = original.lastModified?.getTime();
    if (!originalTime) continue;
    const nextOriginalTime = originals
      .filter((candidate) => (candidate.lastModified?.getTime() ?? 0) > originalTime)
      .map((candidate) => candidate.lastModified?.getTime() ?? Number.POSITIVE_INFINITY)
      .sort((a, b) => a - b)[0];
    const deterministicEnd = Math.min(nextOriginalTime ?? Number.POSITIVE_INFINITY, originalTime + 10_000);
    const following = imageObjectsByTime.filter((object) => {
      const time = object.lastModified?.getTime() ?? 0;
      return time > originalTime && time < deterministicEnd;
    });
    const webCandidates = following.filter((object) => object.group === "images/web/");
    const thumbnailCandidates = following.filter((object) => object.group === "images/thumbnails/");
    if (webCandidates.length !== 1 || thumbnailCandidates.length !== 1) continue;
    if ((webCandidates[0].lastModified?.getTime() ?? 0) > (thumbnailCandidates[0].lastModified?.getTime() ?? 0)) continue;

    trios.push({
      original,
      web: webCandidates[0],
      thumbnail: thumbnailCandidates[0],
      localMatches: original.etag ? localByMd5.get(original.etag) ?? [] : [],
    });
  }

  return trios;
}

function sameNullableNumber(expected: number | null | undefined, actual: number | undefined): boolean {
  return expected == null || expected === actual;
}

function sameNullableMime(expected: string | null | undefined, actual: string | undefined): boolean {
  return !expected || !actual || expected.toLowerCase() === actual.toLowerCase();
}

function findLocalMatches(row: ProjectImageRow, localFiles: LocalFile[]): LocalFile[] {
  const hasStrongMetadata = row.fileSize != null || (row.width != null && row.height != null);
  if (!hasStrongMetadata) return [];

  return localFiles.filter((file) => {
    if (!sameNullableNumber(row.fileSize, file.size)) return false;
    if (!sameNullableNumber(row.width, file.width)) return false;
    if (!sameNullableNumber(row.height, file.height)) return false;
    if (!sameNullableMime(row.mimeType, file.mimeType)) return false;
    return true;
  });
}

function classifyProjectImage(
  row: ProjectImageRow,
  existingKeys: Set<string>,
  localFiles: LocalFile[],
  imageTrios: ImageTrio[],
): RowPlan {
  const dbKeys = uniqueDbKeys(row);
  const missingKeys = dbKeys.filter((key) => !existingKeys.has(key));
  const plannedObjects = plannedRoles(row, existingKeys);

  if (dbKeys.length > 0 && missingKeys.length === 0) {
    return { row, classification: "EXACT_MATCH", localMatches: [], missingKeys, plannedObjects };
  }

  const localMatches = findLocalMatches(row, localFiles);
  if (localMatches.length === 1) {
    const remapTrio = imageTrios.find((trio) => trio.localMatches.some((file) => file.md5 === localMatches[0].md5));
    if (remapTrio) {
      return {
        row,
        classification: "REMAP_SAFE",
        localMatches,
        missingKeys,
        plannedObjects,
        excludedReason: "Matched local source already has an existing deterministic R2 trio, so this is not RESTORE_SAFE.",
      };
    }

    return { row, classification: "RESTORE_SAFE", localMatches, missingKeys, plannedObjects };
  }

  return {
    row,
    classification: "UNRESOLVED",
    localMatches,
    missingKeys,
    plannedObjects,
    excludedReason:
      localMatches.length === 0
        ? "No conservative single local source match was found."
        : `${localMatches.length} local source matches were found, which is ambiguous.`,
  };
}

async function readProjectImages(prisma: PrismaClient): Promise<ProjectImageRow[]> {
  return prisma.projectImage.findMany({
    select: {
      id: true,
      url: true,
      originalUrl: true,
      webUrl: true,
      thumbnailUrl: true,
      fileSize: true,
      width: true,
      height: true,
      mimeType: true,
      sortOrder: true,
      createdAt: true,
      project: {
        select: {
          slug: true,
          title: true,
          titleTr: true,
          titleEn: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
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

async function revalidateSource(row: ProjectImageRow, localFile: LocalFile): Promise<Buffer> {
  const buffer = await readFile(localFile.absolutePath);
  const metadata = await sharp(buffer, { failOn: "error" }).metadata();
  const actualMime = sharpMimeType(metadata.format) ?? extensionMimeType(localFile.absolutePath);

  if (!sameNullableNumber(row.fileSize, buffer.length)) {
    throw new Error(`File size changed for ${localFile.relativePath}`);
  }
  if (!sameNullableNumber(row.width, metadata.width)) {
    throw new Error(`Image width changed for ${localFile.relativePath}`);
  }
  if (!sameNullableNumber(row.height, metadata.height)) {
    throw new Error(`Image height changed for ${localFile.relativePath}`);
  }
  if (!sameNullableMime(row.mimeType, actualMime)) {
    throw new Error(`Image MIME type changed for ${localFile.relativePath}`);
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

async function uploadMissingObject(
  client: S3Client,
  bucketName: string,
  object: PlannedObject,
  body: Buffer,
): Promise<UploadResult> {
  try {
    if (await objectExists(client, bucketName, object.key)) {
      return { key: object.key, status: "skipped-existing" };
    }

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
    return {
      key: object.key,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printDryRunRow(plan: RowPlan): void {
  const source = plan.localMatches[0];
  console.log(
    JSON.stringify(
      {
        projectImageId: plan.row.id,
        project: projectLabel(plan.row),
        localSourcePath: source.relativePath,
        expectedOriginalKey: tryExtractR2Key(plan.row.originalUrl),
        expectedWebKey: tryExtractR2Key(plan.row.webUrl) ?? tryExtractR2Key(plan.row.url),
        expectedThumbnailKey: tryExtractR2Key(plan.row.thumbnailUrl),
        currentlyMissing: plan.missingKeys,
        plannedObjectsToUpload: plan.plannedObjects
          .filter((object) => !object.exists)
          .map((object) => ({ key: object.key, role: object.role, contentType: object.contentType })),
      },
      null,
      2,
    ),
  );
}

function countPlans(plans: RowPlan[], classification: Classification): number {
  return plans.filter((plan) => plan.classification === classification).length;
}

async function main(): Promise<void> {
  const mode = parseMode();
  const { databaseUrl, bucketName } = requireProductionEnvironment();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const r2 = getR2Client();

  console.log(`ProjectImage R2 restore (${mode === "execute" ? "EXECUTE" : "DRY RUN"})`);
  console.log(`Database: ${safeDatabaseDescription(databaseUrl)}`);
  console.log(`R2 bucket: ${bucketName}`);
  console.log("Scope: ProjectImage only");
  console.log("Database updates: disabled");
  console.log("R2 deletes: disabled");

  try {
    const [rows, r2Objects, localFiles] = await Promise.all([readProjectImages(prisma), listR2Objects(r2, bucketName), inspectLocalUploads()]);
    const existingKeys = new Set(r2Objects.map((object) => object.key));
    const imageTrios = associateImageTrios(r2Objects, indexByMd5(localFiles));
    const plans = rows.map((row) => classifyProjectImage(row, existingKeys, localFiles, imageTrios));
    const eligiblePlans = plans.filter((plan) => plan.classification === "RESTORE_SAFE");
    const repairablePlans = eligiblePlans.filter((plan) => plan.plannedObjects.some((object) => !object.exists));
    const ambiguousExclusions = plans.filter((plan) => plan.classification === "UNRESOLVED" && plan.localMatches.length > 1);

    if (mode === "dry-run") {
      console.log("\nRepairable ProjectImage rows");
      for (const plan of repairablePlans) printDryRunRow(plan);
    }

    const plannedUploadObjects = repairablePlans.flatMap((plan) => plan.plannedObjects.filter((object) => !object.exists));
    let uploadResults: UploadResult[] = [];

    if (mode === "execute") {
      for (const plan of repairablePlans) {
        const source = plan.localMatches[0];
        try {
          const sourceBuffer = await revalidateSource(plan.row, source);
          const variantBuffers = await buildVariantBuffers(sourceBuffer);
          for (const object of plan.plannedObjects.filter((plannedObject) => !plannedObject.exists)) {
            uploadResults.push(await uploadMissingObject(r2, bucketName, object, variantBuffers[object.role]));
          }
        } catch (error) {
          uploadResults.push({
            key: `${plan.row.id}:source`,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    console.log(`\nProjectImage rows checked: ${rows.length}`);
    console.log(`EXACT_MATCH skipped: ${countPlans(plans, "EXACT_MATCH")}`);
    console.log(`RESTORE_SAFE eligible: ${eligiblePlans.length}`);
    console.log(`REMAP_SAFE skipped: ${countPlans(plans, "REMAP_SAFE")}`);
    console.log(`UNRESOLVED skipped: ${countPlans(plans, "UNRESOLVED")}`);
    console.log(`Objects already existing: ${eligiblePlans.flatMap((plan) => plan.plannedObjects.filter((object) => object.exists)).length}`);
    console.log(`Objects planned for upload: ${plannedUploadObjects.length}`);
    console.log(`Rows excluded due to ambiguity: ${ambiguousExclusions.length}`);

    const firstRestoreSafe = repairablePlans[0] ?? eligiblePlans[0];
    if (firstRestoreSafe) {
      console.log("\nFirst RESTORE_SAFE mapping");
      printDryRunRow(firstRestoreSafe);
    }

    if (mode === "execute") {
      console.log("\nExecute summary");
      console.log(`uploaded objects: ${uploadResults.filter((result) => result.status === "uploaded").length}`);
      console.log(`skipped existing objects: ${uploadResults.filter((result) => result.status === "skipped-existing").length}`);
      console.log(`failed objects: ${uploadResults.filter((result) => result.status === "failed").length}`);
      for (const failure of uploadResults.filter((result) => result.status === "failed")) {
        console.log(`- FAILED ${failure.key}: ${failure.error}`);
      }
      console.log("database updates performed: 0");
      console.log("delete operations performed: 0");
    } else {
      console.log("\nDry-run summary");
      console.log("Database writes: 0");
      console.log("R2 deletes: 0");
      console.log("R2 uploads: 0");
      console.log("Run with --execute only after reviewing the dry-run output.");
    }
  } finally {
    await prisma.$disconnect();
    r2.destroy();
  }
}

main().catch((error) => {
  console.error("ProjectImage R2 restore failed.");
  console.error("Database updates performed: 0");
  console.error("Delete operations performed: 0");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
