import { createHash } from "crypto";
import { createReadStream } from "fs";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";
import { resolveDatabaseLocation } from "../src/lib/database-url";
import { getR2PublicUrl, r2ObjectExists, uploadToR2 } from "../src/lib/r2";

loadEnvConfig(process.cwd());

const dryRun = process.argv.includes("--dry-run");
const uploadsRoot = path.join(process.cwd(), "public", "uploads");
const databaseLocation = resolveDatabaseLocation();
const prisma = new PrismaClient({ datasourceUrl: databaseLocation.datasourceUrl });

type LocalAsset = {
  absolutePath: string;
  relativePath: string;
  key: string;
  hash: string;
  contentType: string;
};

type UrlChange = {
  model: string;
  id: string;
  field: string;
  from: string;
  to: string;
};

type RecordUpdate = {
  changes: UrlChange[];
  apply: () => Promise<unknown>;
};

const mimeTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

async function scanDirectory(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await scanDirectory(entryPath));
    else if (entry.isFile() && entry.name !== ".gitkeep") files.push(entryPath);
  }
  return files;
}

async function loadAssets(): Promise<LocalAsset[]> {
  const files = await scanDirectory(uploadsRoot);
  const assets: LocalAsset[] = [];

  for (const absolutePath of files) {
    const relativePath = path.relative(uploadsRoot, absolutePath).split(path.sep).join("/");
    assets.push({
      absolutePath,
      relativePath,
      key: `uploads/${relativePath}`,
      hash: await hashFile(absolutePath),
      contentType: mimeTypes[path.extname(relativePath).toLowerCase()] ?? "application/octet-stream",
    });
  }

  return assets;
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function groupByHash(assets: LocalAsset[]): LocalAsset[][] {
  const groups = new Map<string, LocalAsset[]>();
  for (const asset of assets) {
    const group = groups.get(asset.hash) ?? [];
    group.push(asset);
    groups.set(asset.hash, group);
  }
  return [...groups.values()];
}

function localRelativePath(url: string): string | null {
  const match = url.match(/^\/(?:api\/)?uploads\/(.+?)(?:[?#].*)?$/);
  if (!match) return null;

  try {
    const relativePath = decodeURIComponent(match[1]).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!relativePath || relativePath.split("/").includes("..")) return null;
    return relativePath;
  } catch {
    return null;
  }
}

function collectRecordChanges<T extends object>(
  model: string,
  id: string,
  record: T,
  fields: Array<keyof T & string>,
  urlsByRelativePath: Map<string, string>,
  unresolvedUrls: Set<string>,
): { changes: UrlChange[]; data: Record<string, string> } {
  const changes: UrlChange[] = [];
  const data: Record<string, string> = {};

  for (const field of fields) {
    const from = record[field];
    if (typeof from !== "string") continue;
    const relativePath = localRelativePath(from);
    if (!relativePath) continue;
    const to = urlsByRelativePath.get(relativePath);
    if (!to) {
      unresolvedUrls.add(from);
      continue;
    }
    if (to === from) continue;
    changes.push({ model, id, field, from, to });
    data[field] = to;
  }

  return { changes, data };
}

async function buildDatabaseUpdates(
  urlsByRelativePath: Map<string, string>,
): Promise<{ updates: RecordUpdate[]; unresolvedUrls: Set<string> }> {
  const [projectImages, projects, heroes, aboutPages, references] = await Promise.all([
    prisma.projectImage.findMany(),
    prisma.project.findMany(),
    prisma.homepageHero.findMany(),
    prisma.aboutPage.findMany(),
    prisma.reference.findMany(),
  ]);
  const updates: RecordUpdate[] = [];
  const unresolvedUrls = new Set<string>();

  for (const record of projectImages) {
    const result = collectRecordChanges(
      "ProjectImage",
      record.id,
      record,
      ["url", "originalUrl", "webUrl", "thumbnailUrl"],
      urlsByRelativePath,
      unresolvedUrls,
    );
    if (result.changes.length) updates.push({
      changes: result.changes,
      apply: () => prisma.projectImage.update({
        where: { id: record.id },
        data: result.data as Prisma.ProjectImageUpdateInput,
      }),
    });
  }

  for (const record of projects) {
    const result = collectRecordChanges("Project", record.id, record, ["pdfUrl"], urlsByRelativePath, unresolvedUrls);
    if (result.changes.length) updates.push({
      changes: result.changes,
      apply: () => prisma.project.update({ where: { id: record.id }, data: result.data as Prisma.ProjectUpdateInput }),
    });
  }

  for (const record of heroes) {
    const result = collectRecordChanges(
      "HomepageHero",
      record.id,
      record,
      ["imageUrl", "imageOriginalUrl", "imageWebUrl", "imageThumbnailUrl", "videoUrl"],
      urlsByRelativePath,
      unresolvedUrls,
    );
    if (result.changes.length) updates.push({
      changes: result.changes,
      apply: () => prisma.homepageHero.update({
        where: { id: record.id },
        data: result.data as Prisma.HomepageHeroUpdateInput,
      }),
    });
  }

  for (const record of aboutPages) {
    const result = collectRecordChanges(
      "AboutPage",
      record.id,
      record,
      ["imageUrl", "imageOriginalUrl", "imageWebUrl", "imageThumbnailUrl"],
      urlsByRelativePath,
      unresolvedUrls,
    );
    if (result.changes.length) updates.push({
      changes: result.changes,
      apply: () => prisma.aboutPage.update({
        where: { id: record.id },
        data: result.data as Prisma.AboutPageUpdateInput,
      }),
    });
  }

  for (const record of references) {
    const result = collectRecordChanges(
      "Reference",
      record.id,
      record,
      ["logoUrl", "logoOriginalUrl", "logoWebUrl", "logoThumbnailUrl"],
      urlsByRelativePath,
      unresolvedUrls,
    );
    if (result.changes.length) updates.push({
      changes: result.changes,
      apply: () => prisma.reference.update({
        where: { id: record.id },
        data: result.data as Prisma.ReferenceUpdateInput,
      }),
    });
  }

  return { updates, unresolvedUrls };
}

async function main() {
  console.log(dryRun ? "Cloudflare R2 upload migration (DRY RUN)" : "Cloudflare R2 upload migration");
  console.log(`Source: ${uploadsRoot}`);
  console.log(`Database: ${databaseLocation.filePath ?? databaseLocation.datasourceUrl}`);

  const assets = await loadAssets();
  const urlsByRelativePath = new Map<string, string>();
  let migratedFiles = 0;
  let plannedFiles = 0;
  let skippedFiles = 0;
  const failedFiles: string[] = [];

  console.log(`\nLocal files found: ${assets.length}`);
  const existenceByKey = new Map<string, boolean>();
  const headBatchSize = 24;
  for (let index = 0; index < assets.length; index += headBatchSize) {
    const batch = assets.slice(index, index + headBatchSize);
    const results = await Promise.all(batch.map(async (asset) => ({
      key: asset.key,
      exists: await r2ObjectExists(asset.key),
    })));
    for (const result of results) existenceByKey.set(result.key, result.exists);
    if (assets.length > headBatchSize) {
      console.log(`[R2 CHECK] ${Math.min(index + batch.length, assets.length)}/${assets.length}`);
    }
  }

  for (const group of groupByHash(assets)) {
    const existing = group.filter((asset) => existenceByKey.get(asset.key));

    const canonical = existing[0] ?? group[0];
    const targetUrl = getR2PublicUrl(canonical.key);

    if (existing.length > 0) {
      for (const asset of group) {
        urlsByRelativePath.set(asset.relativePath, targetUrl);
        if (existing.includes(asset)) console.log(`[SKIP: R2 EXISTS] ${asset.relativePath}`);
        else console.log(`[SKIP: DUPLICATE] ${asset.relativePath} -> ${canonical.relativePath}`);
        skippedFiles += 1;
      }
      continue;
    }

    if (dryRun) {
      console.log(`[MIGRATE] ${canonical.relativePath} -> ${canonical.key}`);
      plannedFiles += 1;
      urlsByRelativePath.set(canonical.relativePath, targetUrl);
      for (const duplicate of group.slice(1)) {
        console.log(`[SKIP: DUPLICATE] ${duplicate.relativePath} -> ${canonical.relativePath}`);
        urlsByRelativePath.set(duplicate.relativePath, targetUrl);
        skippedFiles += 1;
      }
      continue;
    }

    try {
      const body = await readFile(canonical.absolutePath);
      const uploaded = await uploadToR2(body, {
        key: canonical.key,
        contentType: canonical.contentType,
        originalFilename: path.basename(canonical.relativePath),
      });
      console.log(`[MIGRATED] ${canonical.relativePath} -> ${uploaded.key}`);
      migratedFiles += 1;
      for (const asset of group) urlsByRelativePath.set(asset.relativePath, uploaded.url);
      for (const duplicate of group.slice(1)) {
        console.log(`[SKIP: DUPLICATE] ${duplicate.relativePath} -> ${canonical.relativePath}`);
        skippedFiles += 1;
      }
    } catch (error) {
      console.error(`[FAILED] ${canonical.relativePath}`, error);
      for (const asset of group) failedFiles.push(asset.relativePath);
    }
  }

  const { updates, unresolvedUrls } = await buildDatabaseUpdates(urlsByRelativePath);
  const changes = updates.flatMap((update) => update.changes);
  console.log(`\nDatabase URL changes: ${changes.length}`);
  for (const change of changes) {
    console.log(`[DB] ${change.model} ${change.id}.${change.field}: ${change.from} -> ${change.to}`);
  }
  for (const url of unresolvedUrls) console.warn(`[DB: UNRESOLVED] No local file migrated for ${url}`);

  let updatedDatabaseRecords = 0;
  let failedDatabaseRecords = 0;
  if (!dryRun) {
    for (const update of updates) {
      try {
        await update.apply();
        updatedDatabaseRecords += 1;
      } catch (error) {
        failedDatabaseRecords += 1;
        console.error(`[DB: FAILED] ${update.changes[0]?.model} ${update.changes[0]?.id}`, error);
      }
    }
  }

  console.log("\nSummary");
  if (dryRun) console.log(`files planned for migration: ${plannedFiles}`);
  console.log(`migrated files: ${migratedFiles}`);
  console.log(`skipped files: ${skippedFiles}`);
  console.log(`updated database records: ${updatedDatabaseRecords}`);
  if (dryRun) console.log(`database records planned for update: ${updates.length}`);
  console.log(`failed files: ${failedFiles.length}`);
  console.log(`failed database records: ${failedDatabaseRecords}`);
  console.log(`unresolved database URLs: ${unresolvedUrls.size}`);
  console.log("Local files were not deleted.");

  if (failedFiles.length || failedDatabaseRecords || unresolvedUrls.size) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Migration failed before completion", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
