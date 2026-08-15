import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionSchema = path.join(projectRoot, "prisma", "schema.prisma");
const localSchema = path.join(projectRoot, "prisma", "sqlite", "schema.prisma");
const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");

function readEnvironmentValue(name) {
  if (process.env[name]) return process.env[name];

  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(projectRoot, filename);
    if (!existsSync(envPath)) continue;
    const value = parseEnv(readFileSync(envPath, "utf8"))[name];
    if (value) return value;
  }

  return undefined;
}

function absoluteSqliteUrl(databaseUrl) {
  const value = databaseUrl.slice("file:".length);
  const queryIndex = value.indexOf("?");
  const rawPath = queryIndex === -1 ? value : value.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : value.slice(queryIndex);

  if (rawPath === ":memory:" || path.isAbsolute(rawPath)) return databaseUrl;

  const absolutePath = path.resolve(projectRoot, "prisma", decodeURIComponent(rawPath)).replace(/\\/g, "/");
  return `file:${absolutePath}${query}`;
}

const rawArgs = process.argv.slice(2);
const forceLocal = rawArgs.includes("--local");
const forcePostgres = rawArgs.includes("--postgres");
const args = rawArgs.filter((arg) => arg !== "--local" && arg !== "--postgres");
const configuredUrl = readEnvironmentValue("DATABASE_URL");
const configuredDirectUrl = readEnvironmentValue("DIRECT_URL");

if (forceLocal && forcePostgres) {
  console.error("Choose either --local or --postgres, not both.");
  process.exit(1);
}

if (forceLocal && !configuredUrl?.startsWith("file:")) {
  console.error('SQLite mode requires DATABASE_URL="file:./dev.db".');
  process.exit(1);
}

if (forcePostgres && !configuredUrl?.startsWith("postgresql:") && !configuredUrl?.startsWith("postgres:")) {
  console.error("PostgreSQL mode requires a postgresql:// or postgres:// DATABASE_URL.");
  process.exit(1);
}

const useLocal = forceLocal || (!forcePostgres && configuredUrl?.startsWith("file:"));

if (!useLocal && configuredUrl && !configuredUrl.startsWith("postgresql:") && !configuredUrl.startsWith("postgres:")) {
  console.error("DATABASE_URL must use file:, postgresql:, or postgres:.");
  process.exit(1);
}

if (!useLocal && (forcePostgres || configuredUrl) && !configuredDirectUrl) {
  console.error("PostgreSQL mode requires DIRECT_URL (use the Neon direct, non-pooled URL).");
  process.exit(1);
}

const databaseUrl = useLocal
  ? absoluteSqliteUrl(configuredUrl)
  : configuredUrl ?? "postgresql://prisma:prisma@localhost:5432/prisma";
const schema = useLocal ? localSchema : productionSchema;

const result = spawnSync(process.execPath, [prismaCli, ...args, "--schema", schema], {
  cwd: projectRoot,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: configuredDirectUrl ?? databaseUrl,
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
