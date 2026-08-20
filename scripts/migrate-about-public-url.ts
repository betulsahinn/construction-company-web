import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

const EXPECTED_R2_BUCKET = "turkuvaz-insaat";
const OLD_R2_PUBLIC_URL = "https://pub-4ee483fa5b544b4e86ba1ca3e49e47ec.r2.dev";
const NEW_R2_PUBLIC_URL = "https://cdn.turkuvazinsaat.com";
const ABOUT_IMAGE_FIELDS = ["imageUrl", "imageWebUrl", "imageThumbnailUrl", "imageOriginalUrl"] as const;

type Mode = "dry-run" | "execute";
type AboutImageField = (typeof ABOUT_IMAGE_FIELDS)[number];
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type AboutPageRow = {
  id: string;
  imageUrl: string | null;
  imageWebUrl: string | null;
  imageThumbnailUrl: string | null;
  imageOriginalUrl: string | null;
};

type FieldChange = {
  field: AboutImageField;
  before: string;
  after: string;
};

type RowPlan = {
  id: string;
  keys: string[];
  missingKeys: string[];
  changes: FieldChange[];
  unsafeReasons: string[];
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
  if (!hasBase(value, OLD_R2_PUBLIC_URL)) return value;
  return `${NEW_R2_PUBLIC_URL}${value.slice(OLD_R2_PUBLIC_URL.length)}`;
}

function extractKnownR2Key(value: string): { key?: string; unsafeReason?: string } {
  try {
    const parsed = new URL(value);
    const isKnownHost = parsed.origin === OLD_R2_PUBLIC_URL || parsed.origin === NEW_R2_PUBLIC_URL;
    if (!isKnownHost) return { unsafeReason: `Unrecognized AboutPage image URL host: ${parsed.origin}` };

    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    if (!key) return { unsafeReason: `URL has no R2 object key: ${value}` };
    return { key };
  } catch {
    return { unsafeReason: `Invalid AboutPage image URL: ${value}` };
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

async function readAboutPages(client: DatabaseClient): Promise<AboutPageRow[]> {
  return client.aboutPage.findMany({
    select: {
      id: true,
      imageUrl: true,
      imageWebUrl: true,
      imageThumbnailUrl: true,
      imageOriginalUrl: true,
    },
    orderBy: { id: "asc" },
  });
}

function valueForField(row: AboutPageRow, field: AboutImageField): string | null {
  return row[field];
}

async function buildPlans(rows: AboutPageRow[], r2: S3Client, bucketName: string): Promise<RowPlan[]> {
  const extractedByRow = rows.map((row) => {
    const keys: string[] = [];
    const unsafeReasons: string[] = [];
    const changes: FieldChange[] = [];

    for (const field of ABOUT_IMAGE_FIELDS) {
      const value = valueForField(row, field);
      if (!value) continue;

      const extracted = extractKnownR2Key(value);
      if (extracted.key) keys.push(extracted.key);
      if (extracted.unsafeReason) unsafeReasons.push(`${field}: ${extracted.unsafeReason}`);

      const after = migrateUrl(value);
      if (after !== value) changes.push({ field, before: value, after });
    }

    return { row, keys: [...new Set(keys)].sort(), unsafeReasons, changes };
  });

  const uniqueKeys = [...new Set(extractedByRow.flatMap((item) => item.keys))].sort();
  const existencePairs = await mapLimit(uniqueKeys, 12, async (key) => [key, await objectExists(r2, bucketName, key)] as const);
  const existsByKey = new Map(existencePairs);

  return extractedByRow.map((item) => {
    const missingKeys = item.keys.filter((key) => !existsByKey.get(key));
    return {
      id: item.row.id,
      keys: item.keys,
      missingKeys,
      changes: item.changes,
      unsafeReasons: [
        ...item.unsafeReasons,
        ...missingKeys.map((key) => `Missing R2 object in ${EXPECTED_R2_BUCKET}: ${key}`),
      ],
    };
  });
}

function safePlansWithChanges(plans: RowPlan[]): RowPlan[] {
  return plans.filter((plan) => plan.unsafeReasons.length === 0 && plan.changes.length > 0);
}

function printBeforeAfter(plans: RowPlan[]): void {
  console.log("\nBefore/after values");
  const changes = plans.flatMap((plan) => plan.changes.map((change) => ({ id: plan.id, ...change })));
  if (changes.length === 0) {
    console.log("- none");
    return;
  }

  for (const change of changes) {
    console.log(`[${change.id}] ${change.field}`);
    console.log(`before: ${change.before}`);
    console.log(`after:  ${change.after}`);
  }
}

function printUnsafeRows(plans: RowPlan[]): void {
  const unsafePlans = plans.filter((plan) => plan.unsafeReasons.length > 0);
  if (unsafePlans.length === 0) return;

  console.log("\nUnsafe rows");
  for (const plan of unsafePlans) {
    console.log(`- ${plan.id}`);
    for (const reason of plan.unsafeReasons) console.log(`  ${reason}`);
  }
}

function updateDataForPlan(plan: RowPlan): Partial<Record<AboutImageField, string>> {
  return plan.changes.reduce<Partial<Record<AboutImageField, string>>>((data, change) => {
    data[change.field] = change.after;
    return data;
  }, {});
}

async function executeMigration(prisma: PrismaClient, plans: RowPlan[]): Promise<{ rowsUpdated: number; urlValuesUpdated: number }> {
  const executablePlans = safePlansWithChanges(plans);

  return prisma.$transaction(
    async (transaction) => {
      const currentRows = await readAboutPages(transaction);
      const currentById = new Map(currentRows.map((row) => [row.id, row]));
      let rowsUpdated = 0;
      let urlValuesUpdated = 0;

      for (const plan of executablePlans) {
        const current = currentById.get(plan.id);
        if (!current) throw new Error(`AboutPage disappeared before update: ${plan.id}`);

        for (const change of plan.changes) {
          if (valueForField(current, change.field) !== change.before) {
            throw new Error(`AboutPage ${plan.id}.${change.field} changed after dry-run planning; aborting transaction.`);
          }
        }

        await transaction.aboutPage.update({
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

async function main(): Promise<void> {
  const mode = parseMode();
  const { databaseUrl, bucketName } = requireExpectedEnvironment();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const r2 = getR2Client();

  console.log(`AboutPage public URL hostname migration (${mode === "execute" ? "EXECUTE" : "DRY RUN"})`);
  console.log(`Database: ${databaseDescription(databaseUrl)}`);
  console.log(`R2 bucket: ${bucketName}`);
  console.log(`Old base: ${OLD_R2_PUBLIC_URL}`);
  console.log(`New base: ${NEW_R2_PUBLIC_URL}`);
  console.log("Scope: AboutPage.imageUrl, imageWebUrl, imageThumbnailUrl, imageOriginalUrl only");
  console.log("R2 writes/deletes: disabled");

  try {
    const rows = await readAboutPages(prisma);
    const plans = await buildPlans(rows, r2, bucketName);
    const allKeys = [...new Set(plans.flatMap((plan) => plan.keys))];
    const missingKeys = [...new Set(plans.flatMap((plan) => plan.missingKeys))];
    const urlValuesThatWouldChange = safePlansWithChanges(plans).reduce((count, plan) => count + plan.changes.length, 0);
    const safeToMigrate = plans.every((plan) => plan.unsafeReasons.length === 0);

    console.log("\nPlan summary");
    console.log(`AboutPage rows checked: ${plans.length}`);
    console.log(`Objects verified in R2: ${allKeys.length - missingKeys.length}`);
    console.log(`Missing objects: ${missingKeys.length}`);
    console.log(`URL values that would change: ${urlValuesThatWouldChange}`);
    console.log(`Safe to migrate: ${safeToMigrate ? "YES" : "NO"}`);

    printBeforeAfter(safePlansWithChanges(plans));
    printUnsafeRows(plans);

    if (mode === "dry-run") {
      console.log("\nDatabase writes: 0");
      return;
    }

    if (!safeToMigrate) throw new Error("Refusing execute mode because one or more AboutPage image objects are missing or unsafe.");

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
  console.error("AboutPage public URL migration failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
