import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { parseEnv } from "node:util";

type Row = Record<string, unknown>;
type Action = "created" | "updated" | "skipped";

type Delegate = {
  count(): Promise<number>;
  findMany(): Promise<Row[]>;
  upsert(args: { where: Row; create: Row; update: Row }): Promise<unknown>;
};

type DelegateName =
  | "user"
  | "category"
  | "project"
  | "projectImage"
  | "projectCategory"
  | "homepageHero"
  | "aboutPage"
  | "contactPage"
  | "footerSettings"
  | "reference"
  | "faq";

type MigrationClient = Record<DelegateName, Delegate> & {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction<T>(
    callback: (transaction: MigrationClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
};

type MigrationClientConstructor = new (options: {
  datasourceUrl: string;
  log: Array<"error" | "warn">;
}) => MigrationClient;

type ModelSpec = {
  table: string;
  delegate: DelegateName;
  keyFields: string[];
  compositeWhere?: string;
  uniqueFields?: string[];
  dateFields?: string[];
  booleanFields?: string[];
  urlFields?: string[];
};

type ModelData = {
  spec: ModelSpec;
  sourceRows: Row[];
  targetRows: Row[];
  actions: Map<string, Action>;
};

const projectRoot = path.resolve(import.meta.dirname, "..");
const sqlitePath = path.join(projectRoot, "prisma", "dev.db");
const generatedClientPath = path.join(projectRoot, ".prisma-clients", "postgres");
const dryRun = !process.argv.includes("--execute");

const models: ModelSpec[] = [
  {
    table: "User",
    delegate: "user",
    keyFields: ["id"],
    uniqueFields: ["email"],
    dateFields: ["createdAt", "updatedAt"],
  },
  {
    table: "Category",
    delegate: "category",
    keyFields: ["id"],
    uniqueFields: ["name", "slug"],
    dateFields: ["createdAt", "updatedAt"],
  },
  {
    table: "Project",
    delegate: "project",
    keyFields: ["id"],
    uniqueFields: ["slug"],
    dateFields: ["createdAt", "updatedAt"],
    booleanFields: ["featured", "published"],
    urlFields: ["pdfUrl"],
  },
  {
    table: "ProjectImage",
    delegate: "projectImage",
    keyFields: ["id"],
    dateFields: ["createdAt"],
    urlFields: ["url", "originalUrl", "webUrl", "thumbnailUrl"],
  },
  {
    table: "ProjectCategory",
    delegate: "projectCategory",
    keyFields: ["projectId", "categoryId"],
    compositeWhere: "projectId_categoryId",
  },
  {
    table: "HomepageHero",
    delegate: "homepageHero",
    keyFields: ["id"],
    dateFields: ["createdAt", "updatedAt"],
    urlFields: ["imageUrl", "imageOriginalUrl", "imageWebUrl", "imageThumbnailUrl", "videoUrl"],
  },
  {
    table: "AboutPage",
    delegate: "aboutPage",
    keyFields: ["id"],
    dateFields: ["createdAt", "updatedAt"],
    urlFields: ["imageUrl", "imageOriginalUrl", "imageWebUrl", "imageThumbnailUrl"],
  },
  {
    table: "ContactPage",
    delegate: "contactPage",
    keyFields: ["id"],
    dateFields: ["createdAt", "updatedAt"],
  },
  {
    table: "FooterSettings",
    delegate: "footerSettings",
    keyFields: ["id"],
    dateFields: ["createdAt", "updatedAt"],
  },
  {
    table: "Reference",
    delegate: "reference",
    keyFields: ["id"],
    dateFields: ["createdAt", "updatedAt"],
    booleanFields: ["published"],
    urlFields: ["websiteUrl", "logoUrl", "logoOriginalUrl", "logoWebUrl", "logoThumbnailUrl"],
  },
  {
    table: "Faq",
    delegate: "faq",
    keyFields: ["id"],
    dateFields: ["createdAt", "updatedAt"],
    booleanFields: ["published"],
  },
];

function readEnvironmentValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];

  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(projectRoot, filename);
    if (!existsSync(envPath)) continue;
    const value = parseEnv(readFileSync(envPath, "utf8"))[name];
    if (value) return value;
  }

  return undefined;
}

function fileHash(filename: string): string {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

function targetLabel(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, "") || "(default database)";
  return `${url.hostname}/${database}`;
}

function asDate(value: unknown, model: string, field: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "number" && typeof value !== "bigint" && typeof value !== "string") {
    throw new Error(`${model}.${field} contains an invalid date value.`);
  }

  const date = new Date(typeof value === "bigint" ? Number(value) : value);
  if (Number.isNaN(date.getTime())) throw new Error(`${model}.${field} contains an invalid date value.`);
  return date;
}

function transformSourceRow(spec: ModelSpec, source: Row): Row {
  const row = { ...source };

  for (const field of spec.dateFields ?? []) {
    row[field] = asDate(row[field], spec.table, field);
  }

  for (const field of spec.booleanFields ?? []) {
    const value = row[field];
    const normalizedValue = typeof value === "bigint" ? value.toString() : value;
    if (normalizedValue !== true && normalizedValue !== false && normalizedValue !== 0 && normalizedValue !== 1
      && normalizedValue !== "0" && normalizedValue !== "1") {
      throw new Error(`${spec.table}.${field} contains an invalid boolean value.`);
    }
    row[field] = normalizedValue === true || normalizedValue === 1 || normalizedValue === "1";
  }

  for (const field of spec.urlFields ?? []) {
    const value = row[field];
    if (value !== null && typeof value !== "string") {
      throw new Error(`${spec.table}.${field} must be a string or null; no file transfer is permitted.`);
    }
  }

  return row;
}

function recordKey(spec: ModelSpec, row: Row): string {
  return spec.keyFields.map((field) => {
    const value = row[field];
    if (typeof value !== "string" || !value) {
      throw new Error(`${spec.table}.${field} must be a non-empty string.`);
    }
    return value;
  }).join("\u0000");
}

function whereFor(spec: ModelSpec, row: Row): Row {
  const fields = Object.fromEntries(spec.keyFields.map((field) => [field, row[field]]));
  return spec.compositeWhere ? { [spec.compositeWhere]: fields } : fields;
}

function updateData(spec: ModelSpec, row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([field]) => !spec.keyFields.includes(field)));
}

function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}

function rowsEqual(left: Row, right: Row): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  if (leftEntries.length !== rightEntries.length) return false;

  return leftEntries.every(([field, value], index) => {
    const [rightField, rightValue] = rightEntries[index];
    return field === rightField && comparable(value) === comparable(rightValue);
  });
}

function buildPlan(spec: ModelSpec, sourceRows: Row[], targetRows: Row[]): {
  actions: Map<string, Action>;
  errors: string[];
} {
  const errors: string[] = [];
  const actions = new Map<string, Action>();
  const sourceByKey = new Map(sourceRows.map((row) => [recordKey(spec, row), row]));
  const targetByKey = new Map(targetRows.map((row) => [recordKey(spec, row), row]));

  for (const targetKey of targetByKey.keys()) {
    if (!sourceByKey.has(targetKey)) {
      errors.push(`${spec.table}: PostgreSQL contains a record not present in SQLite (${targetKey.replace("\u0000", "/")}).`);
    }
  }

  for (const [key, sourceRow] of sourceByKey) {
    const targetRow = targetByKey.get(key);
    actions.set(key, targetRow ? (rowsEqual(sourceRow, targetRow) ? "skipped" : "updated") : "created");
  }

  for (const field of spec.uniqueFields ?? []) {
    const targetUniqueValues = new Map<string, string>();
    for (const [key, row] of targetByKey) {
      const value = row[field];
      if (typeof value === "string") targetUniqueValues.set(value, key);
    }

    for (const [key, row] of sourceByKey) {
      const value = row[field];
      if (typeof value !== "string") continue;
      const occupyingKey = targetUniqueValues.get(value);
      if (occupyingKey && occupyingKey !== key) {
        errors.push(`${spec.table}.${field}: PostgreSQL value ${JSON.stringify(value)} belongs to a different ID.`);
      }
    }
  }

  return { actions, errors };
}

function countActions(modelData: ModelData, action: Action): number {
  return [...modelData.actions.values()].filter((value) => value === action).length;
}

function printCounts(title: string, data: ModelData[], source: "source" | "target"): void {
  console.log(`\n${title}`);
  for (const model of data) {
    const count = source === "source" ? model.sourceRows.length : model.targetRows.length;
    console.log(`  ${model.spec.table.padEnd(20)} ${count}`);
  }
}

function printPlan(data: ModelData[]): void {
  console.log("\nMigration plan");
  console.log("  Model".padEnd(24) + "Create".padStart(9) + "Update".padStart(9) + "Skip".padStart(9));
  for (const model of data) {
    console.log(
      `  ${model.spec.table}`.padEnd(24)
      + String(countActions(model, "created")).padStart(9)
      + String(countActions(model, "updated")).padStart(9)
      + String(countActions(model, "skipped")).padStart(9),
    );
  }

  for (const action of ["created", "updated", "skipped"] as const) {
    const total = data.reduce((sum, model) => sum + countActions(model, action), 0);
    console.log(`  Total ${action.padEnd(7)} ${total}`);
  }
}

async function readTarget(client: MigrationClient, sourceData: Array<{ spec: ModelSpec; sourceRows: Row[] }>): Promise<ModelData[]> {
  const data: ModelData[] = [];
  for (const sourceModel of sourceData) {
    const targetRows = await client[sourceModel.spec.delegate].findMany();
    const plan = buildPlan(sourceModel.spec, sourceModel.sourceRows, targetRows);
    data.push({ ...sourceModel, targetRows, actions: plan.actions });
  }
  return data;
}

function collectPlanErrors(data: ModelData[]): string[] {
  return data.flatMap((model) => buildPlan(model.spec, model.sourceRows, model.targetRows).errors);
}

async function verifyTarget(client: MigrationClient, sourceData: Array<{ spec: ModelSpec; sourceRows: Row[] }>): Promise<ModelData[]> {
  const after = await readTarget(client, sourceData);
  const errors: string[] = [];

  for (const model of after) {
    if (model.sourceRows.length !== model.targetRows.length) {
      errors.push(`${model.spec.table}: SQLite=${model.sourceRows.length}, PostgreSQL=${model.targetRows.length}`);
      continue;
    }

    const targetByKey = new Map(model.targetRows.map((row) => [recordKey(model.spec, row), row]));
    for (const sourceRow of model.sourceRows) {
      const key = recordKey(model.spec, sourceRow);
      const targetRow = targetByKey.get(key);
      if (!targetRow || !rowsEqual(sourceRow, targetRow)) {
        errors.push(`${model.spec.table}: value mismatch for ${key.replace("\u0000", "/")}`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Post-migration verification failed; transaction rolled back:\n- ${errors.join("\n- ")}`);
  }

  return after;
}

async function main(): Promise<void> {
  const postgresUrl = readEnvironmentValue("POSTGRES_DATABASE_URL");
  if (!postgresUrl) throw new Error("POSTGRES_DATABASE_URL is required. DATABASE_URL is not used by this migration.");
  if (!postgresUrl.startsWith("postgresql:") && !postgresUrl.startsWith("postgres:")) {
    throw new Error("POSTGRES_DATABASE_URL must be a PostgreSQL URL; file: URLs are rejected.");
  }
  if (!existsSync(sqlitePath) || !statSync(sqlitePath).isFile()) {
    throw new Error(`SQLite source not found: ${sqlitePath}`);
  }
  if (!existsSync(generatedClientPath)) {
    throw new Error("The isolated PostgreSQL migration client is missing. Run the migration through its npm script.");
  }

  console.log(dryRun ? "DRY RUN — PostgreSQL will not be modified." : "EXECUTE MODE — PostgreSQL will be updated atomically.");
  console.log(`SQLite source (read-only): ${sqlitePath}`);
  console.log(`PostgreSQL target: ${targetLabel(postgresUrl)}`);
  console.log("Media policy: URLs are copied as strings; no R2 or filesystem upload/delete operation is performed.");

  const sourceHashBefore = fileHash(sqlitePath);
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
  let sourceData: Array<{ spec: ModelSpec; sourceRows: Row[] }>;
  try {
    sourceData = models.map((spec) => ({
      spec,
      sourceRows: (sqlite.prepare(`SELECT * FROM "${spec.table}"`).all() as unknown as Row[])
        .map((row) => transformSourceRow(spec, row)),
    }));
  } finally {
    sqlite.close();
  }

  const require = createRequire(import.meta.url);
  const generated = require(generatedClientPath) as { PrismaClient: MigrationClientConstructor };
  const postgres = new generated.PrismaClient({ datasourceUrl: postgresUrl, log: ["error", "warn"] });

  try {
    await postgres.$connect();
    const before = await readTarget(postgres, sourceData);
    const planErrors = collectPlanErrors(before);

    printCounts("Source counts (SQLite)", before, "source");
    printCounts("Target counts before (PostgreSQL)", before, "target");
    printPlan(before);

    if (planErrors.length) {
      console.error("\nSafety checks failed. No records were written:");
      for (const error of planErrors) console.error(`  - ${error}`);
      throw new Error("Resolve PostgreSQL conflicts or use an empty target database, then run dry-run again.");
    }

    if (dryRun) {
      printCounts("Target counts after dry-run (unchanged)", before, "target");
      console.log("\nDry-run complete. No PostgreSQL writes were issued.");
      return;
    }

    const after = await postgres.$transaction(async (transaction) => {
      for (const model of before) {
        const delegate = transaction[model.spec.delegate];
        for (const sourceRow of model.sourceRows) {
          const key = recordKey(model.spec, sourceRow);
          if (model.actions.get(key) === "skipped") continue;
          await delegate.upsert({
            where: whereFor(model.spec, sourceRow),
            create: sourceRow,
            update: updateData(model.spec, sourceRow),
          });
        }
      }

      const verified = await verifyTarget(transaction, sourceData);
      if (fileHash(sqlitePath) !== sourceHashBefore) {
        throw new Error("SQLite changed during migration; PostgreSQL transaction rolled back.");
      }
      return verified;
    }, { maxWait: 30_000, timeout: 300_000 });

    printCounts("Target counts after (PostgreSQL)", after, "target");
    console.log("\nMigration complete. Counts and scalar values match SQLite for every model.");
  } finally {
    await postgres.$disconnect();
    const sourceHashAfter = fileHash(sqlitePath);
    if (sourceHashAfter !== sourceHashBefore) {
      throw new Error("Safety violation: prisma/dev.db changed during migration.");
    }
    console.log("SQLite SHA-256 unchanged; prisma/dev.db was not modified.");
  }
}

main().catch((error: unknown) => {
  console.error("\nMigration failed safely.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
