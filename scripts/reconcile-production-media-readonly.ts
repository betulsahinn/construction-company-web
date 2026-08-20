import { createHash } from "crypto";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

loadEnvConfig(process.cwd());

const EXPECTED_R2_BUCKET = "turkuvaz-insaat";
const OLD_R2_PUBLIC_URL = "https://pub-4ee483fa5b544b4e86ba1ca3e49e47ec.r2.dev";
const NEW_R2_PUBLIC_URL = "https://cdn.turkuvazinsaat.com";
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const TARGET_TRACE_KEY = "images/thumbnails/049907ef-28b2-4c23-ad44-e94bb5024ec3.webp";
const READ_ONLY_FORBIDDEN_FLAGS = new Set(["--execute", "--write", "--apply", "--fix", "--restore"]);

type MediaKind = "ProjectImage" | "HomepageHero" | "AboutPage" | "Reference" | "ProjectPdf";
type Classification = "EXACT_MATCH" | "REMAP_SAFE" | "RESTORE_SAFE" | "UNRESOLVED";
type R2Group = "images/originals/" | "images/web/" | "images/thumbnails/" | "project-videos/" | "uploads/" | "other";

type MediaMetadata = {
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
};

type MediaRow = {
  kind: MediaKind;
  id: string;
  label: string;
  urlFields: Record<string, string | null | undefined>;
  metadata: MediaMetadata;
  sortOrder?: number | null;
  createdAt?: Date | null;
};

type R2Object = {
  key: string;
  size: number;
  etag?: string;
  lastModified?: Date;
  contentType?: string;
  group: R2Group;
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

type ImageTrio = {
  original: R2Object;
  web: R2Object;
  thumbnail: R2Object;
  localMatches: LocalFile[];
  evidence: string[];
};

type ClassificationResult = {
  classification: Classification;
  evidence: string[];
  dbKeys: string[];
  missingDbKeys: string[];
  localMatches: LocalFile[];
  remapTrio?: ImageTrio;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assertPermanentReadOnly(): void {
  const requestedWriteFlag = process.argv.slice(2).find((arg) => READ_ONLY_FORBIDDEN_FLAGS.has(arg));
  if (requestedWriteFlag) {
    throw new Error(`Refusing ${requestedWriteFlag}. This reconciliation script is permanently read-only.`);
  }
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
  if (extension === ".gif") return "image/gif";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".pdf") return "application/pdf";
  return undefined;
}

function sharpMimeType(format?: keyof sharp.FormatEnum): string | undefined {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  if (format === "gif") return "image/gif";
  if (format === "svg") return "image/svg+xml";
  return undefined;
}

function tryExtractR2Key(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    const isKnownR2Host =
      parsed.hostname.endsWith(".r2.dev") || parsed.origin === NEW_R2_PUBLIC_URL || parsed.origin === OLD_R2_PUBLIC_URL;
    if (!isKnownR2Host) return undefined;
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || undefined;
  } catch {
    const relativeKey = trimmed.replace(/^\/+/, "");
    if (/^(images\/|uploads\/|project-videos\/)/.test(relativeKey)) return decodeURIComponent(relativeKey);
    return undefined;
  }
}

function uniqueKeysForRow(row: MediaRow): string[] {
  return [...new Set(Object.values(row.urlFields).map(tryExtractR2Key).filter((key): key is string => Boolean(key)))].sort();
}

function mediaRowKey(row: MediaRow): string {
  return `${row.kind}:${row.id}`;
}

async function listR2Objects(client: S3Client, bucketName: string): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
      }),
    );

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

  await mapLimit(objects, 16, async (object) => {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: object.key }));
    object.contentType = head.ContentType;
  });

  return objects.sort((a, b) => a.key.localeCompare(b.key));
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
  const [fileBuffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
  const md5 = createHash("md5").update(fileBuffer).digest("hex");
  const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
  let width: number | undefined;
  let height: number | undefined;
  let mimeType = extensionMimeType(filePath);

  if (mimeType?.startsWith("image/") && mimeType !== "image/svg+xml") {
    try {
      const metadata = await sharp(fileBuffer, { animated: false }).metadata();
      width = metadata.width;
      height = metadata.height;
      mimeType = sharpMimeType(metadata.format) ?? mimeType;
    } catch {
      // Non-critical: hashes and file size are still useful for reconciliation.
    }
  }

  return {
    relativePath,
    absolutePath: filePath,
    size: fileStat.size,
    md5,
    sha256,
    width,
    height,
    mimeType,
  };
}

async function inspectLocalUploads(): Promise<LocalFile[]> {
  const uploadStat = await stat(LOCAL_UPLOADS_DIR).catch(() => null);
  if (!uploadStat?.isDirectory()) return [];

  const files = await walkFiles(LOCAL_UPLOADS_DIR);
  return mapLimit(files, 8, inspectLocalFile);
}

function indexByMd5(localFiles: LocalFile[]): Map<string, LocalFile[]> {
  const index = new Map<string, LocalFile[]>();
  for (const file of localFiles) {
    const existing = index.get(file.md5) ?? [];
    existing.push(file);
    index.set(file.md5, existing);
  }
  return index;
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
    const web = webCandidates[0];
    const thumbnail = thumbnailCandidates[0];
    if ((web.lastModified?.getTime() ?? 0) > (thumbnail.lastModified?.getTime() ?? 0)) continue;

    const localMatches = original.etag ? localByMd5.get(original.etag) ?? [] : [];
    trios.push({
      original,
      web,
      thumbnail,
      localMatches,
      evidence: [
        "R2 upload chronology is original -> web -> thumbnail before the next original object.",
        original.etag
          ? `Original ETag ${original.etag} matched ${localMatches.length} local file MD5 value(s).`
          : "Original ETag was not a single-part MD5 value.",
      ],
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

function findLocalMatches(row: MediaRow, localFiles: LocalFile[]): LocalFile[] {
  const metadata = row.metadata;
  const hasStrongMetadata = metadata.fileSize != null || (metadata.width != null && metadata.height != null);
  if (!hasStrongMetadata) return [];

  return localFiles.filter((file) => {
    if (!sameNullableNumber(metadata.fileSize, file.size)) return false;
    if (!sameNullableNumber(metadata.width, file.width)) return false;
    if (!sameNullableNumber(metadata.height, file.height)) return false;
    if (!sameNullableMime(metadata.mimeType, file.mimeType)) return false;
    return true;
  });
}

function classifyRow(
  row: MediaRow,
  r2ByKey: Map<string, R2Object>,
  localFiles: LocalFile[],
  imageTrios: ImageTrio[],
): ClassificationResult {
  const dbKeys = uniqueKeysForRow(row);
  const missingDbKeys = dbKeys.filter((key) => !r2ByKey.has(key));

  if (dbKeys.length > 0 && missingDbKeys.length === 0) {
    return {
      classification: "EXACT_MATCH",
      evidence: ["Every R2 key referenced by this production database row exists in the Turkuvaz bucket."],
      dbKeys,
      missingDbKeys,
      localMatches: [],
    };
  }

  const localMatches = findLocalMatches(row, localFiles);
  if (localMatches.length === 1) {
    const localMatch = localMatches[0];
    const remapTrio = imageTrios.find((trio) => trio.localMatches.some((file) => file.md5 === localMatch.md5));

    if (remapTrio && row.kind !== "ProjectPdf") {
      return {
        classification: "REMAP_SAFE",
        evidence: [
          "Production row metadata matched exactly one local source file.",
          "That local source MD5 matches an R2 original object ETag.",
          "The R2 original has a deterministic web/thumbnail trio.",
        ],
        dbKeys,
        missingDbKeys,
        localMatches,
        remapTrio,
      };
    }

    return {
      classification: "RESTORE_SAFE",
      evidence: [
        "Production row metadata matched exactly one local source file.",
        "No existing R2 object/trio was found for that source, so a restore would be required before any URL remap.",
      ],
      dbKeys,
      missingDbKeys,
      localMatches,
    };
  }

  return {
    classification: "UNRESOLVED",
    evidence: [
      missingDbKeys.length > 0
        ? `${missingDbKeys.length} database-referenced R2 key(s) are missing from the Turkuvaz bucket.`
        : "No usable R2 key was found in this row.",
      localMatches.length === 0
        ? "Local source metadata did not produce a conservative unique match."
        : `Local source metadata produced ${localMatches.length} matches, which is ambiguous.`,
    ],
    dbKeys,
    missingDbKeys,
    localMatches,
  };
}

async function readProductionRows(prisma: PrismaClient): Promise<MediaRow[]> {
  const [projectImages, homepageHeroes, aboutPages, references, projectsWithPdf] = await Promise.all([
    prisma.projectImage.findMany({
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
    }),
    prisma.homepageHero.findMany({ orderBy: { id: "asc" } }),
    prisma.aboutPage.findMany({ orderBy: { id: "asc" } }),
    prisma.reference.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.project.findMany({
      where: { pdfUrl: { not: null } },
      select: { id: true, slug: true, title: true, titleTr: true, titleEn: true, pdfUrl: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  return [
    ...projectImages.map<MediaRow>((image) => ({
      kind: "ProjectImage",
      id: image.id,
      label: `${image.project.slug} / ${image.project.titleTr ?? image.project.titleEn ?? image.project.title}`,
      urlFields: {
        url: image.url,
        originalUrl: image.originalUrl,
        webUrl: image.webUrl,
        thumbnailUrl: image.thumbnailUrl,
      },
      metadata: {
        fileSize: image.fileSize,
        width: image.width,
        height: image.height,
        mimeType: image.mimeType,
      },
      sortOrder: image.sortOrder,
      createdAt: image.createdAt,
    })),
    ...homepageHeroes.map<MediaRow>((hero) => ({
      kind: "HomepageHero",
      id: hero.id,
      label: hero.title ?? "Homepage hero",
      urlFields: {
        imageUrl: hero.imageUrl,
        imageOriginalUrl: hero.imageOriginalUrl,
        imageWebUrl: hero.imageWebUrl,
        imageThumbnailUrl: hero.imageThumbnailUrl,
        videoUrl: hero.videoUrl,
      },
      metadata: {},
      createdAt: hero.createdAt,
    })),
    ...aboutPages.map<MediaRow>((about) => ({
      kind: "AboutPage",
      id: about.id,
      label: about.titleTr ?? about.titleEn ?? "About page",
      urlFields: {
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
      createdAt: about.createdAt,
    })),
    ...references.map<MediaRow>((reference) => ({
      kind: "Reference",
      id: reference.id,
      label: reference.companyName,
      urlFields: {
        logoUrl: reference.logoUrl,
        logoOriginalUrl: reference.logoOriginalUrl,
        logoWebUrl: reference.logoWebUrl,
        logoThumbnailUrl: reference.logoThumbnailUrl,
      },
      metadata: {
        fileSize: reference.logoFileSize,
        width: reference.logoWidth,
        height: reference.logoHeight,
        mimeType: reference.logoMimeType,
      },
      sortOrder: reference.sortOrder,
      createdAt: reference.createdAt,
    })),
    ...projectsWithPdf.map<MediaRow>((project) => ({
      kind: "ProjectPdf",
      id: project.id,
      label: `${project.slug} / ${project.titleTr ?? project.titleEn ?? project.title}`,
      urlFields: { pdfUrl: project.pdfUrl },
      metadata: {},
      createdAt: project.createdAt,
    })),
  ];
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (counts, value) => {
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    },
    {} as Record<T, number>,
  );
}

function printTrace(title: string, rows: MediaRow[], results: Map<string, ClassificationResult>): void {
  console.log(`\n${title}`);
  for (const row of rows) {
    const result = results.get(mediaRowKey(row));
    if (!result) continue;
    console.log(
      JSON.stringify(
        {
          kind: row.kind,
          id: row.id,
          label: row.label,
          sortOrder: row.sortOrder,
          metadata: row.metadata,
          dbKeys: result.dbKeys,
          missingDbKeys: result.missingDbKeys,
          classification: result.classification,
          evidence: result.evidence,
          localMatches: result.localMatches.map((file) => ({
            path: file.relativePath,
            size: file.size,
            width: file.width,
            height: file.height,
            mimeType: file.mimeType,
            md5: file.md5,
          })),
          remapKeys: result.remapTrio
            ? {
                originalUrl: `${NEW_R2_PUBLIC_URL}/${result.remapTrio.original.key}`,
                webUrl: `${NEW_R2_PUBLIC_URL}/${result.remapTrio.web.key}`,
                thumbnailUrl: `${NEW_R2_PUBLIC_URL}/${result.remapTrio.thumbnail.key}`,
                url: `${NEW_R2_PUBLIC_URL}/${result.remapTrio.web.key}`,
              }
            : undefined,
        },
        null,
        2,
      ),
    );
  }
}

function printTargetTrace(target: R2Object | undefined, imageTrios: ImageTrio[], rows: MediaRow[], results: Map<string, ClassificationResult>): void {
  console.log(`\nTarget object trace: ${TARGET_TRACE_KEY}`);
  if (!target) {
    console.log("Target object exists: NO");
    return;
  }

  const targetTrio = imageTrios.find((trio) => trio.thumbnail.key === TARGET_TRACE_KEY);
  const matchingRows = rows.filter((row) => {
    const result = results.get(mediaRowKey(row));
    return result?.remapTrio?.thumbnail.key === TARGET_TRACE_KEY || uniqueKeysForRow(row).includes(TARGET_TRACE_KEY);
  });

  console.log(
    JSON.stringify(
      {
        target,
        detectedTrio: targetTrio
          ? {
              original: targetTrio.original,
              web: targetTrio.web,
              thumbnail: targetTrio.thumbnail,
              localMatches: targetTrio.localMatches.map((file) => file.relativePath),
              evidence: targetTrio.evidence,
            }
          : null,
        productionRowsUsingOrMappingToTarget: matchingRows.map((row) => ({
          kind: row.kind,
          id: row.id,
          label: row.label,
          classification: results.get(mediaRowKey(row))?.classification,
        })),
      },
      null,
      2,
    ),
  );
}

function recommendation(classifications: Classification[]): string {
  const counts = countBy(classifications);
  const unresolved = counts.UNRESOLVED ?? 0;
  const restoreSafe = counts.RESTORE_SAFE ?? 0;
  const remapSafe = counts.REMAP_SAFE ?? 0;

  if (unresolved === 0 && restoreSafe === 0) {
    return "Recommendation A: DB-only URL remap is supportable for the rows classified EXACT_MATCH or REMAP_SAFE.";
  }
  if (remapSafe > 0 || restoreSafe > 0) {
    return "Recommendation B: Use a mixed plan. Remap only REMAP_SAFE rows, restore RESTORE_SAFE sources first, and leave UNRESOLVED rows untouched pending manual review.";
  }
  return "Recommendation C: Do not run an automated media remap yet. The production/media evidence is insufficient without manual asset review.";
}

async function main(): Promise<void> {
  assertPermanentReadOnly();
  const { databaseUrl, bucketName } = requireProductionEnvironment();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const r2 = getR2Client();

  console.log("Turkuvaz production media reconciliation (STRICT READ ONLY)");
  console.log(`Database: ${safeDatabaseDescription(databaseUrl)}`);
  console.log(`R2 bucket: ${bucketName}`);
  console.log("Database operation: SELECT only");
  console.log("R2 operations: ListObjectsV2 + HeadObject only");
  console.log("Local filesystem operation: read/hash public/uploads only");

  try {
    const [rows, r2Objects, localFiles] = await Promise.all([
      readProductionRows(prisma),
      listR2Objects(r2, bucketName),
      inspectLocalUploads(),
    ]);

    const r2ByKey = new Map(r2Objects.map((object) => [object.key, object]));
    const localByMd5 = indexByMd5(localFiles);
    const imageTrios = associateImageTrios(r2Objects, localByMd5);
    const results = new Map<string, ClassificationResult>();

    for (const row of rows) {
      results.set(mediaRowKey(row), classifyRow(row, r2ByKey, localFiles, imageTrios));
    }

    const classifications = [...results.values()].map((result) => result.classification);
    const rowsByKind = countBy(rows.map((row) => row.kind));
    const classificationCounts = countBy(classifications);
    const oldUrlValues = rows.flatMap((row) => Object.values(row.urlFields)).filter((url) => url?.startsWith(OLD_R2_PUBLIC_URL)).length;
    const allDbKeys = [...new Set(rows.flatMap(uniqueKeysForRow))].sort();
    const missingDbKeys = allDbKeys.filter((key) => !r2ByKey.has(key));

    console.log("\nProduction rows read");
    for (const [kind, count] of Object.entries(rowsByKind)) console.log(`- ${kind}: ${count}`);

    console.log("\nR2 inventory");
    console.log(`Total R2 objects: ${r2Objects.length}`);
    for (const group of ["images/originals/", "images/web/", "images/thumbnails/", "project-videos/", "uploads/", "other"] as const) {
      console.log(`- ${group}: ${r2Objects.filter((object) => object.group === group).length}`);
    }
    console.log(`Deterministic image trios detected: ${imageTrios.length}`);
    console.log(`Image trios with local original MD5 match: ${imageTrios.filter((trio) => trio.localMatches.length > 0).length}`);

    console.log("\nLocal upload source inventory");
    console.log(`Local files inspected: ${localFiles.length}`);
    console.log(`Unique local MD5 values: ${localByMd5.size}`);

    console.log("\nDatabase URL/key inventory");
    console.log(`OLD_R2_PUBLIC_URL values seen: ${oldUrlValues}`);
    console.log(`Unique DB-referenced R2 keys: ${allDbKeys.length}`);
    console.log(`DB-referenced keys existing in R2: ${allDbKeys.length - missingDbKeys.length}`);
    console.log(`DB-referenced keys missing in R2: ${missingDbKeys.length}`);

    console.log("\nClassification summary");
    for (const status of ["EXACT_MATCH", "REMAP_SAFE", "RESTORE_SAFE", "UNRESOLVED"] as const) {
      console.log(`- ${status}: ${classificationCounts[status] ?? 0}`);
    }

    console.log("\nClassification by type");
    for (const kind of ["ProjectImage", "HomepageHero", "AboutPage", "Reference", "ProjectPdf"] as const) {
      const kindClassifications = rows
        .filter((row) => row.kind === kind)
        .map((row) => results.get(mediaRowKey(row))?.classification)
        .filter(Boolean);
      const counts = countBy(kindClassifications as Classification[]);
      console.log(
        `- ${kind}: EXACT_MATCH ${counts.EXACT_MATCH ?? 0}, REMAP_SAFE ${counts.REMAP_SAFE ?? 0}, RESTORE_SAFE ${
          counts.RESTORE_SAFE ?? 0
        }, UNRESOLVED ${counts.UNRESOLVED ?? 0}`,
      );
    }

    printTrace(
      "HomepageHero trace",
      rows.filter((row) => row.kind === "HomepageHero"),
      results,
    );
    printTrace(
      "AboutPage trace",
      rows.filter((row) => row.kind === "AboutPage"),
      results,
    );
    printTrace(
      "First 5 ProjectImage trace",
      rows.filter((row) => row.kind === "ProjectImage").slice(0, 5),
      results,
    );
    printTargetTrace(r2ByKey.get(TARGET_TRACE_KEY), imageTrios, rows, results);

    if (missingDbKeys.length > 0) {
      console.log("\nMissing DB-referenced R2 keys");
      for (const key of missingDbKeys) console.log(`- ${key}`);
    }

    console.log("\nRead-only totals");
    console.log("Database writes: 0");
    console.log("R2 uploads: 0");
    console.log("R2 deletes: 0");
    console.log("R2 copies/moves: 0");
    console.log(recommendation(classifications));
  } finally {
    await prisma.$disconnect();
    r2.destroy();
  }
}

main().catch((error) => {
  console.error("Production media reconciliation failed. Database writes: 0. R2 uploads: 0. R2 deletes: 0.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
