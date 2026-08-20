import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

const EXPECTED_R2_BUCKET = "turkuvaz-insaat";
const OLD_MEHMET_ESER_R2_PUBLIC_URL = "https://pub-4ee483fa5b544b4e86ba1ca3e49e47ec.r2.dev";
const OLD_TURKUVAZ_R2_PUBLIC_URL = "https://pub-c6b041d39e1b4bfab50101c0171e1b06.r2.dev";
const NEW_R2_PUBLIC_URL = "https://cdn.turkuvazinsaat.com";
const PROJECT_IMAGE_FIELDS = ["url", "webUrl", "thumbnailUrl", "originalUrl"] as const;
const OLD_BASES = [OLD_MEHMET_ESER_R2_PUBLIC_URL, OLD_TURKUVAZ_R2_PUBLIC_URL] as const;

type Mode = "dry-run" | "execute";
type ProjectImageField = (typeof PROJECT_IMAGE_FIELDS)[number];
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type ProjectImageRow = {
  id: string;
  url: string;
  webUrl: string | null;
  thumbnailUrl: string | null;
  originalUrl: string | null;
};

type FieldChange = {
  field: ProjectImageField;
  before: string;
  after: string;
};

type RowPlan = {
  id: string;
  values: Record<ProjectImageField, string | null>;
  keys: string[];
  missingKeys: string[];
  changes: FieldChange[];
  unsafeReasons: string[];
  usesMehmetEserOldBase: boolean;
  usesTurkuvazOldBase: boolean;
  alreadyFullyCdn: boolean;
};

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseMode(): Mode {
  const args = process.argv.slice(2);
  if (args.length === 0) return "dry-run";
  if (args.length === 1 && args[0] === "--execute") return "execute";
  throw new Error("Unknown mode. Run without flags for dry-run, or with --execute for database updates.");
}

function requireExpectedEnvironment(): { databaseUrl: string; bucketName: string } {
  const databaseUrl = requiredEnvironmentVariable("DATABASE_URL");
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("DATABASE_URL must point to PostgreSQL. This migration refuses SQLite and other providers.");
  }

  const bucketName = requiredEnvironmentVariable("CLOUDFLARE_R2_BUCKET_NAME");
  if (bucketName !== EXPECTED_R2_BUCKET) {
    throw new Error(`Refusing R2 bucket "${bucketName}". Expected "${EXPECTED_R2_BUCKET}" only.`);
  }

  return { databaseUrl, bucketName };
}

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnvironmentVariable("CLOUDFLARE_R2_ENDPOINT"),
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: requiredEnvironmentVariable("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnvironmentVariable("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
}

function databaseDescription(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  if (parsed.username) parsed.username = "<user>";
  if (parsed.password) parsed.password = "<password>";
  return parsed.toString();
}

function hasBase(value: string, base: string): boolean {
  return value === base || value.startsWith(`${base}/`);
}

function migrateUrl(value: string): string {
  for (const oldBase of OLD_BASES) {
    if (hasBase(value, oldBase)) return `${NEW_R2_PUBLIC_URL}${value.slice(oldBase.length)}`;
  }
  return value;
}

function extractKnownR2Key(value: string): { key?: string; unsafeReason?: string } {
  try {
    const parsed = new URL(value);
    const isKnownHost =
      parsed.origin === NEW_R2_PUBLIC_URL ||
      parsed.origin === OLD_MEHMET_ESER_R2_PUBLIC_URL ||
      parsed.origin === OLD_TURKUVAZ_R2_PUBLIC_URL;

    if (!isKnownHost) {
      return { unsafeReason: `Unrecognized ProjectImage URL host: ${parsed.origin}` };
    }

    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    if (!key) return { unsafeReason: `URL has no R2 object key: ${value}` };
    return { key };
  } catch {
    return { unsafeReason: `Invalid ProjectImage URL: ${value}` };
  }
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

function rowValues(row: ProjectImageRow): Record<ProjectImageField, string | null> {
  return {
    url: row.url,
    webUrl: row.webUrl,
    thumbnailUrl: row.thumbnailUrl,
    originalUrl: row.originalUrl,
  };
}

async function readProjectImages(client: DatabaseClient): Promise<ProjectImageRow[]> {
  return client.projectImage.findMany({
    select: {
      id: true,
      url: true,
      webUrl: true,
      thumbnailUrl: true,
      originalUrl: true,
    },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
}

async function buildPlans(rows: ProjectImageRow[], r2: S3Client, bucketName: string): Promise<RowPlan[]> {
  const extractedByRow = rows.map((row) => {
    const values = rowValues(row);
    const unsafeReasons: string[] = [];
    const keys: string[] = [];
    const changes: FieldChange[] = [];
    let usesMehmetEserOldBase = false;
    let usesTurkuvazOldBase = false;

    for (const field of PROJECT_IMAGE_FIELDS) {
      const value = values[field];
      if (!value) continue;

      if (hasBase(value, OLD_MEHMET_ESER_R2_PUBLIC_URL)) usesMehmetEserOldBase = true;
      if (hasBase(value, OLD_TURKUVAZ_R2_PUBLIC_URL)) usesTurkuvazOldBase = true;

      const extracted = extractKnownR2Key(value);
      if (extracted.key) keys.push(extracted.key);
      if (extracted.unsafeReason) unsafeReasons.push(`${field}: ${extracted.unsafeReason}`);

      const after = migrateUrl(value);
      if (after !== value) changes.push({ field, before: value, after });
    }

    const nonNullValues = PROJECT_IMAGE_FIELDS.map((field) => values[field]).filter((value): value is string => Boolean(value));
    const alreadyFullyCdn = nonNullValues.length > 0 && nonNullValues.every((value) => hasBase(value, NEW_R2_PUBLIC_URL));

    return {
      row,
      values,
      unsafeReasons,
      keys: [...new Set(keys)].sort(),
      changes,
      usesMehmetEserOldBase,
      usesTurkuvazOldBase,
      alreadyFullyCdn,
    };
  });

  const uniqueKeys = [...new Set(extractedByRow.flatMap((item) => item.keys))].sort();
  const existencePairs = await mapLimit(uniqueKeys, 16, async (key) => [key, await objectExists(r2, bucketName, key)] as const);
  const existsByKey = new Map(existencePairs);

  return extractedByRow.map((item) => {
    const missingKeys = item.keys.filter((key) => !existsByKey.get(key));
    return {
      id: item.row.id,
      values: item.values,
      keys: item.keys,
      missingKeys,
      changes: item.changes,
      unsafeReasons: [
        ...item.unsafeReasons,
        ...missingKeys.map((key) => `Missing R2 object in ${EXPECTED_R2_BUCKET}: ${key}`),
      ],
      usesMehmetEserOldBase: item.usesMehmetEserOldBase,
      usesTurkuvazOldBase: item.usesTurkuvazOldBase,
      alreadyFullyCdn: item.alreadyFullyCdn,
    };
  });
}

function safePlansWithChanges(plans: RowPlan[]): RowPlan[] {
  return plans.filter((plan) => plan.unsafeReasons.length === 0 && plan.changes.length > 0);
}

function printExamples(plans: RowPlan[]): void {
  const examples = plans.flatMap((plan) => plan.changes.map((change) => ({ id: plan.id, ...change }))).slice(0, 3);

  console.log("\nBefore/after examples");
  if (examples.length === 0) {
    console.log("- none");
    return;
  }

  for (const example of examples) {
    console.log(`[${example.id}] ${example.field}`);
    console.log(`before: ${example.before}`);
    console.log(`after:  ${example.after}`);
  }
}

function printUnsafe(plans: RowPlan[]): void {
  const unsafePlans = plans.filter((plan) => plan.unsafeReasons.length > 0);
  if (unsafePlans.length === 0) return;

  console.log("\nUnsafe rows skipped");
  for (const plan of unsafePlans) {
    console.log(`- ${plan.id}`);
    for (const reason of plan.unsafeReasons) console.log(`  ${reason}`);
  }
}

function updateDataForPlan(plan: RowPlan): Partial<Record<ProjectImageField, string>> {
  return plan.changes.reduce<Partial<Record<ProjectImageField, string>>>((data, change) => {
    data[change.field] = change.after;
    return data;
  }, {});
}

async function executeMigration(prisma: PrismaClient, plans: RowPlan[]): Promise<{ rowsUpdated: number; urlValuesUpdated: number }> {
  const executablePlans = safePlansWithChanges(plans);

  return prisma.$transaction(
    async (transaction) => {
      const currentRows = await readProjectImages(transaction);
      const currentById = new Map(currentRows.map((row) => [row.id, row]));
      let rowsUpdated = 0;
      let urlValuesUpdated = 0;

      for (const plan of executablePlans) {
        const current = currentById.get(plan.id);
        if (!current) throw new Error(`ProjectImage disappeared before update: ${plan.id}`);
        const currentValues = rowValues(current);

        for (const change of plan.changes) {
          if (currentValues[change.field] !== change.before) {
            throw new Error(`ProjectImage ${plan.id}.${change.field} changed after dry-run planning; aborting transaction.`);
          }
        }

        await transaction.projectImage.update({
          where: { id: plan.id },
          data: updateDataForPlan(plan),
        });
        rowsUpdated += 1;
        urlValuesUpdated += plan.changes.length;
      }

      return { rowsUpdated, urlValuesUpdated };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 120_000 },
  );
}

function countUrlValuesThatWouldChange(plans: RowPlan[]): number {
  return safePlansWithChanges(plans).reduce((count, plan) => count + plan.changes.length, 0);
}

function countMissingObjects(plans: RowPlan[]): number {
  return new Set(plans.flatMap((plan) => plan.missingKeys)).size;
}

async function main(): Promise<void> {
  const mode = parseMode();
  const { databaseUrl, bucketName } = requireExpectedEnvironment();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const r2 = getR2Client();

  console.log(`ProjectImage public URL hostname migration (${mode === "execute" ? "EXECUTE" : "DRY RUN"})`);
  console.log(`Database: ${databaseDescription(databaseUrl)}`);
  console.log(`R2 bucket: ${bucketName}`);
  console.log(`Old Mehmet Eser base: ${OLD_MEHMET_ESER_R2_PUBLIC_URL}`);
  console.log(`Old Turkuvaz base: ${OLD_TURKUVAZ_R2_PUBLIC_URL}`);
  console.log(`New base: ${NEW_R2_PUBLIC_URL}`);
  console.log("Scope: ProjectImage.url, ProjectImage.webUrl, ProjectImage.thumbnailUrl, ProjectImage.originalUrl only");

  try {
    const rows = await readProjectImages(prisma);
    const plans = await buildPlans(rows, r2, bucketName);
    const safeWithChanges = safePlansWithChanges(plans);
    const unsafePlans = plans.filter((plan) => plan.unsafeReasons.length > 0);

    console.log("\nDry-run plan");
    console.log(`ProjectImage rows checked: ${plans.length}`);
    console.log(`Rows already using cdn.turkuvazinsaat.com: ${plans.filter((plan) => plan.alreadyFullyCdn).length}`);
    console.log(`Rows using old pub-4ee hostname: ${plans.filter((plan) => plan.usesMehmetEserOldBase).length}`);
    console.log(`Rows using Turkuvaz pub-c6b hostname: ${plans.filter((plan) => plan.usesTurkuvazOldBase).length}`);
    console.log(`Safe rows eligible for migration: ${safeWithChanges.length}`);
    console.log(`Unsafe rows skipped: ${unsafePlans.length}`);
    console.log(`URL values that would change: ${countUrlValuesThatWouldChange(plans)}`);
    console.log(`Missing R2 objects: ${countMissingObjects(plans)}`);

    printExamples(safeWithChanges);
    printUnsafe(plans);

    if (mode === "dry-run") {
      console.log("\nDatabase writes: 0");
      return;
    }

    const result = await executeMigration(prisma, plans);
    console.log("\nExecution summary");
    console.log(`Rows updated: ${result.rowsUpdated}`);
    console.log(`URL values updated: ${result.urlValuesUpdated}`);
    console.log("R2 writes/deletes: 0");
  } finally {
    await prisma.$disconnect();
    r2.destroy();
  }
}

main().catch((error) => {
  console.error("ProjectImage public URL migration failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
