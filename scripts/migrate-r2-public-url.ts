import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

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

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

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

function assertMediaFieldCoverage(): void {
  const configured = new Set(MEDIA_FIELDS.map((item) => `${item.model}.${item.field}`));
  if (configured.size !== MEDIA_FIELDS.length) throw new Error("MEDIA_FIELDS contains a duplicate entry.");

  const schemaFields = new Set<string>();
  const discoveredMediaFields = new Set<string>();
  for (const model of Prisma.dmmf.datamodel.models) {
    for (const field of model.fields) {
      const key = `${model.name}.${field.name}`;
      schemaFields.add(key);
      if (field.kind !== "scalar" || field.type !== "String") continue;

      const isProjectImageVariant = model.name === "ProjectImage"
        && ["url", "originalUrl", "webUrl", "thumbnailUrl"].includes(field.name);
      const hasMediaUrlName = /(?:image|video|logo|media|pdf|file).*Url$/i.test(field.name);
      if (isProjectImageVariant || hasMediaUrlName) discoveredMediaFields.add(key);
    }
  }

  const nonexistent = [...configured].filter((key) => !schemaFields.has(key));
  const missing = [...discoveredMediaFields].filter((key) => !configured.has(key));
  if (nonexistent.length || missing.length) {
    throw new Error([
      nonexistent.length ? `Configured fields absent from Prisma schema: ${nonexistent.join(", ")}` : "",
      missing.length ? `Media URL fields missing from migration allowlist: ${missing.join(", ")}` : "",
    ].filter(Boolean).join("\n"));
  }
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeBaseUrl(name: string): string {
  const value = requiredEnvironmentVariable(name).replace(/\/+$/, "");
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }

  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an HTTP(S) base URL without credentials, a query, or a fragment.`);
  }

  return value;
}

function quotedIdentifier(value: string): Prisma.Sql {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return Prisma.raw(`"${value}"`);
}

function matchingOldBase(column: Prisma.Sql, oldBase: string): Prisma.Sql {
  return Prisma.sql`(${column} = ${oldBase} OR starts_with(${column}, ${`${oldBase}/`}))`;
}

function migratedUrl(value: string, oldBase: string, newBase: string): string {
  if (value !== oldBase && !value.startsWith(`${oldBase}/`)) {
    throw new Error(`Refusing to migrate a URL outside OLD_R2_PUBLIC_URL: ${value}`);
  }

  const suffix = value.slice(oldBase.length);
  const result = `${newBase}${suffix}`;
  if (result.slice(newBase.length) !== suffix) throw new Error(`URL suffix changed unexpectedly: ${value}`);
  return result;
}

async function scan(client: DatabaseClient, oldBase: string): Promise<FieldPlan[]> {
  const plans: FieldPlan[] = [];

  for (const mediaField of MEDIA_FIELDS) {
    const table = quotedIdentifier(mediaField.table);
    const column = quotedIdentifier(mediaField.field);
    const rows = await client.$queryRaw<UrlRow[]>(Prisma.sql`
      SELECT "id"::text AS "id", ${column} AS "value"
      FROM ${table}
      WHERE ${matchingOldBase(column, oldBase)}
      ORDER BY "id"
    `);
    plans.push({ ...mediaField, rows });
  }

  return plans;
}

function printPlan(plans: FieldPlan[], oldBase: string, newBase: string): void {
  console.log("\nScanned media URL fields");
  for (const plan of plans) console.log(`- ${plan.model}.${plan.field}: ${plan.rows.length} URL(s)`);

  console.log("\nFields that would change");
  const changedFields = plans.filter((plan) => plan.rows.length > 0);
  if (changedFields.length === 0) console.log("- none");

  for (const plan of changedFields) {
    console.log(`- ${plan.model}.${plan.field}: ${plan.rows.length} URL(s)`);
    for (const row of plan.rows.slice(0, 3)) {
      console.log(`  [${row.id}] before: ${row.value}`);
      console.log(`  [${row.id}] after:  ${migratedUrl(row.value, oldBase, newBase)}`);
    }
  }
}

function countSummary(plans: FieldPlan[]): { fields: number; records: number; urls: number } {
  const records = new Set<string>();
  let fields = 0;
  let urls = 0;

  for (const plan of plans) {
    if (plan.rows.length > 0) fields += 1;
    urls += plan.rows.length;
    for (const row of plan.rows) records.add(`${plan.model}:${row.id}`);
  }

  return { fields, records: records.size, urls };
}

async function verifyExpectedValues(
  client: DatabaseClient,
  plan: FieldPlan,
  oldBase: string,
  newBase: string,
): Promise<number> {
  if (plan.rows.length === 0) return 0;

  const table = quotedIdentifier(plan.table);
  const column = quotedIdentifier(plan.field);
  const ids = Prisma.join(plan.rows.map((row) => row.id));
  const rows = await client.$queryRaw<UrlRow[]>(Prisma.sql`
    SELECT "id"::text AS "id", ${column} AS "value"
    FROM ${table}
    WHERE "id"::text IN (${ids})
  `);
  const actualById = new Map(rows.map((row) => [row.id, row.value]));

  for (const row of plan.rows) {
    const expected = migratedUrl(row.value, oldBase, newBase);
    if (actualById.get(row.id) !== expected) {
      throw new Error(`Verification failed for ${plan.model}.${plan.field} on record ${row.id}.`);
    }
  }

  return plan.rows.length;
}

async function executeMigration(
  prisma: PrismaClient,
  oldBase: string,
  newBase: string,
): Promise<{ plans: FieldPlan[]; verifiedUrls: number }> {
  return prisma.$transaction(async (transaction) => {
    const plans = await scan(transaction, oldBase);
    let verifiedUrls = 0;

    for (const plan of plans) {
      if (plan.rows.length === 0) continue;

      const table = quotedIdentifier(plan.table);
      const column = quotedIdentifier(plan.field);
      const updated = await transaction.$executeRaw(Prisma.sql`
        UPDATE ${table}
        SET ${column} = ${newBase} || substring(${column} FROM char_length(${oldBase}) + 1)
        WHERE ${matchingOldBase(column, oldBase)}
      `);

      if (updated !== plan.rows.length) {
        throw new Error(
          `Update count mismatch for ${plan.model}.${plan.field}: planned ${plan.rows.length}, updated ${updated}.`,
        );
      }

      verifiedUrls += await verifyExpectedValues(transaction, plan, oldBase, newBase);
    }

    const remaining = countSummary(await scan(transaction, oldBase));
    if (remaining.urls !== 0) {
      throw new Error(`Verification found ${remaining.urls} URL(s) that still use OLD_R2_PUBLIC_URL.`);
    }

    return { plans, verifiedUrls };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 120_000 });
}

function databaseDescription(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

async function main(): Promise<void> {
  assertMediaFieldCoverage();

  const dryRun = process.argv.includes("--dry-run");
  const execute = process.argv.includes("--execute");
  if (dryRun === execute) throw new Error("Choose exactly one mode: --dry-run or --execute.");

  const oldBase = normalizeBaseUrl("OLD_R2_PUBLIC_URL");
  const newBase = normalizeBaseUrl("NEW_R2_PUBLIC_URL");
  if (oldBase === newBase) throw new Error("OLD_R2_PUBLIC_URL and NEW_R2_PUBLIC_URL must differ.");

  const databaseUrl = requiredEnvironmentVariable("DATABASE_URL");
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error("DATABASE_URL must point to PostgreSQL. This migration refuses SQLite and other providers.");
  }

  const configuredUploadBase = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim();
  if (configuredUploadBase && normalizeBaseUrl("CLOUDFLARE_R2_PUBLIC_URL") !== newBase) {
    throw new Error("CLOUDFLARE_R2_PUBLIC_URL must match NEW_R2_PUBLIC_URL when it is set.");
  }

  console.log(`R2 public URL migration (${dryRun ? "DRY RUN — READ ONLY" : "EXECUTE"})`);
  console.log(`Database: ${databaseDescription(databaseUrl)}`);
  console.log(`Old base: ${oldBase}`);
  console.log(`New base: ${newBase}`);
  console.log("Object storage operations: disabled (this script only issues database SELECT/UPDATE statements)");
  console.log(
    configuredUploadBase
      ? "Upload public base: CLOUDFLARE_R2_PUBLIC_URL matches NEW_R2_PUBLIC_URL"
      : "Upload public base: CLOUDFLARE_R2_PUBLIC_URL is not set in this shell; configure it in production",
  );

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const initialPlans = await scan(prisma, oldBase);
    printPlan(initialPlans, oldBase, newBase);
    const initial = countSummary(initialPlans);

    console.log("\nPlan summary");
    console.log(`fields with changes: ${initial.fields}`);
    console.log(`records that would change: ${initial.records}`);
    console.log(`URL values that would change: ${initial.urls}`);

    if (dryRun) {
      console.log("writes performed: 0");
      return;
    }

    const result = await executeMigration(prisma, oldBase, newBase);
    const updated = countSummary(result.plans);
    const afterCommit = countSummary(await scan(prisma, oldBase));
    if (afterCommit.urls !== 0) {
      throw new Error(`Post-commit verification found ${afterCommit.urls} old URL(s).`);
    }

    console.log("\nExecution summary");
    console.log(`changed records: ${updated.records}`);
    console.log(`changed URL values: ${updated.urls}`);
    console.log(`verified URL values: ${result.verifiedUrls}`);
    console.log(`remaining old URL values: ${afterCommit.urls}`);
    console.log("R2 objects and object keys were not accessed or changed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Migration failed; no partial transaction was committed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
