import { loadEnvConfig } from "@next/env";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Prisma, PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

const EXPECTED_OLD_R2_PUBLIC_URL = "https://pub-4ee483fa5b544b4e86ba1ca3e49e47ec.r2.dev";
const EXPECTED_NEW_R2_PUBLIC_URL = "https://cdn.turkuvazinsaat.com";
const EXPECTED_R2_BUCKET = "turkuvaz-insaat";

type MediaField = {
  model: string;
  table: string;
  field: string;
};

type UrlRow = {
  id: string;
  value: string;
};

type FieldPlan = MediaField & {
  rows: UrlRow[];
};

const MEDIA_FIELDS: readonly MediaField[] = [
  { model: "Project", table: "Project", field: "pdfUrl" },
  { model: "ProjectImage", table: "ProjectImage", field: "url" },
  { model: "ProjectImage", table: "ProjectImage", field: "thumbnailUrl" },
  { model: "ProjectImage", table: "ProjectImage", field: "webUrl" },
  { model: "ProjectImage", table: "ProjectImage", field: "originalUrl" },
  { model: "Reference", table: "Reference", field: "logoUrl" },
  { model: "Reference", table: "Reference", field: "logoOriginalUrl" },
  { model: "Reference", table: "Reference", field: "logoWebUrl" },
  { model: "Reference", table: "Reference", field: "logoThumbnailUrl" },
  { model: "HomepageHero", table: "HomepageHero", field: "imageUrl" },
  { model: "HomepageHero", table: "HomepageHero", field: "imageOriginalUrl" },
  { model: "HomepageHero", table: "HomepageHero", field: "imageWebUrl" },
  { model: "HomepageHero", table: "HomepageHero", field: "imageThumbnailUrl" },
  { model: "HomepageHero", table: "HomepageHero", field: "videoUrl" },
  { model: "AboutPage", table: "AboutPage", field: "imageUrl" },
  { model: "AboutPage", table: "AboutPage", field: "imageOriginalUrl" },
  { model: "AboutPage", table: "AboutPage", field: "imageWebUrl" },
  { model: "AboutPage", table: "AboutPage", field: "imageThumbnailUrl" },
] as const;

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function requireExpectedEnvironment(): {
  databaseUrl: string;
  oldBase: string;
  newBase: string;
  bucketName: string;
} {
  const databaseUrl = requiredEnvironmentVariable("DATABASE_URL");
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error("DATABASE_URL must point to the Turkuvaz production PostgreSQL database.");
  }

  const oldBase = normalizeBaseUrl(process.env.OLD_R2_PUBLIC_URL?.trim() || EXPECTED_OLD_R2_PUBLIC_URL);
  const newBase = normalizeBaseUrl(process.env.NEW_R2_PUBLIC_URL?.trim() || EXPECTED_NEW_R2_PUBLIC_URL);
  const bucketName = requiredEnvironmentVariable("CLOUDFLARE_R2_BUCKET_NAME");

  if (oldBase !== EXPECTED_OLD_R2_PUBLIC_URL) {
    throw new Error(`OLD_R2_PUBLIC_URL must be ${EXPECTED_OLD_R2_PUBLIC_URL}`);
  }
  if (newBase !== EXPECTED_NEW_R2_PUBLIC_URL) {
    throw new Error(`NEW_R2_PUBLIC_URL must be ${EXPECTED_NEW_R2_PUBLIC_URL}`);
  }
  if (bucketName !== EXPECTED_R2_BUCKET) {
    throw new Error(`CLOUDFLARE_R2_BUCKET_NAME must be ${EXPECTED_R2_BUCKET}`);
  }

  return { databaseUrl, oldBase, newBase, bucketName };
}

function quotedIdentifier(value: string): Prisma.Sql {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return Prisma.raw(`"${value}"`);
}

function matchingOldBase(column: Prisma.Sql, oldBase: string): Prisma.Sql {
  return Prisma.sql`(${column} = ${oldBase} OR starts_with(${column}, ${`${oldBase}/`}))`;
}

function extractObjectKey(value: string, oldBase: string): string {
  if (value !== oldBase && !value.startsWith(`${oldBase}/`)) {
    throw new Error(`URL is outside OLD_R2_PUBLIC_URL: ${value}`);
  }

  const key = decodeURIComponent(value.slice(oldBase.length).replace(/^\/+/, ""));
  if (!key) throw new Error(`URL does not contain an R2 object key: ${value}`);
  return key;
}

async function scan(prisma: PrismaClient, oldBase: string): Promise<FieldPlan[]> {
  const plans: FieldPlan[] = [];

  for (const mediaField of MEDIA_FIELDS) {
    const table = quotedIdentifier(mediaField.table);
    const column = quotedIdentifier(mediaField.field);
    const rows = await prisma.$queryRaw<UrlRow[]>(Prisma.sql`
      SELECT "id"::text AS "id", ${column} AS "value"
      FROM ${table}
      WHERE ${matchingOldBase(column, oldBase)}
      ORDER BY "id"
    `);
    plans.push({ ...mediaField, rows });
  }

  return plans;
}

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: requiredEnvironmentVariable("CLOUDFLARE_R2_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnvironmentVariable("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnvironmentVariable("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
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

function missingGroup(key: string): "images/web/" | "images/thumbnails/" | "images/originals/" | "uploads/" | "other" {
  if (key.startsWith("images/web/")) return "images/web/";
  if (key.startsWith("images/thumbnails/")) return "images/thumbnails/";
  if (key.startsWith("images/originals/")) return "images/originals/";
  if (key.startsWith("uploads/")) return "uploads/";
  return "other";
}

function databaseDescription(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

async function main(): Promise<void> {
  const { databaseUrl, oldBase, newBase, bucketName } = requireExpectedEnvironment();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const r2 = getR2Client();

  console.log("R2 public URL object verification (STRICT READ ONLY)");
  console.log(`Database: ${databaseDescription(databaseUrl)}`);
  console.log(`Old base: ${oldBase}`);
  console.log(`New base: ${newBase}`);
  console.log(`R2 bucket: ${bucketName}`);
  console.log("Database operation: SELECT only");
  console.log("R2 operation: HeadObject only");

  try {
    const plans = await scan(prisma, oldBase);
    const urlValues = plans.flatMap((plan) => plan.rows.map((row) => row.value));
    const uniqueKeys = [...new Set(urlValues.map((value) => extractObjectKey(value, oldBase)))].sort();
    const missingKeys: string[] = [];

    for (const key of uniqueKeys) {
      if (!(await objectExists(r2, bucketName, key))) missingKeys.push(key);
    }

    const existingCount = uniqueKeys.length - missingKeys.length;
    const missingByGroup = new Map<string, string[]>();
    for (const key of missingKeys) {
      const group = missingGroup(key);
      const entries = missingByGroup.get(group) ?? [];
      entries.push(key);
      missingByGroup.set(group, entries);
    }

    console.log("\nFields scanned");
    for (const plan of plans) console.log(`- ${plan.model}.${plan.field}: ${plan.rows.length} URL value(s)`);

    console.log("\nSummary");
    console.log(`URL values checked: ${urlValues.length}`);
    console.log(`Unique R2 keys checked: ${uniqueKeys.length}`);
    console.log(`Existing R2 objects: ${existingCount}`);
    console.log(`Missing R2 objects: ${missingKeys.length}`);
    console.log("Database writes: 0");
    console.log("R2 uploads: 0");
    console.log("R2 deletes: 0");

    console.log("\nMissing objects by type");
    for (const group of ["images/web/", "images/thumbnails/", "images/originals/", "uploads/", "other"]) {
      console.log(`- ${group}: ${missingByGroup.get(group)?.length ?? 0}`);
    }

    if (missingKeys.length > 0) {
      console.log("\nMissing keys");
      for (const key of missingKeys) console.log(`- ${key}`);
    }

    console.log(`\nSAFE TO RUN URL MIGRATION: ${missingKeys.length === 0 ? "YES" : "NO"}`);
  } finally {
    await prisma.$disconnect();
    r2.destroy();
  }
}

main().catch((error) => {
  console.error("Verification failed. Database writes: 0. R2 uploads: 0. R2 deletes: 0.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
