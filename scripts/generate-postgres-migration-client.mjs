import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedRoot = path.join(projectRoot, ".prisma-clients");
const generatedSchema = path.join(generatedRoot, "schema.prisma");
const productionSchema = path.join(projectRoot, "prisma", "schema.prisma");
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

const postgresUrl = readEnvironmentValue("POSTGRES_DATABASE_URL");
const directUrl = readEnvironmentValue("DIRECT_URL") ?? postgresUrl;
if (!postgresUrl) {
  console.error("POSTGRES_DATABASE_URL is required. The main DATABASE_URL is intentionally ignored.");
  process.exit(1);
}

if (!postgresUrl.startsWith("postgresql:") && !postgresUrl.startsWith("postgres:")) {
  console.error("POSTGRES_DATABASE_URL must be a PostgreSQL connection URL.");
  process.exit(1);
}

const sourceSchema = readFileSync(productionSchema, "utf8");
const migrationSchema = sourceSchema.replace(
  /generator\s+client\s*\{[\s\S]*?\}/,
  'generator client {\n  provider = "prisma-client-js"\n  output   = "./postgres"\n}',
);

if (migrationSchema === sourceSchema) {
  console.error("Could not prepare the isolated PostgreSQL migration client schema.");
  process.exit(1);
}

mkdirSync(generatedRoot, { recursive: true });
writeFileSync(generatedSchema, migrationSchema, { encoding: "utf8" });

const result = spawnSync(process.execPath, [prismaCli, "generate", "--schema", generatedSchema], {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: postgresUrl, DIRECT_URL: directUrl },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
