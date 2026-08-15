import { PrismaClient } from "@prisma/client";
import { resolveDatabaseLocation } from "./database-url";

// The mode-specific npm scripts regenerate @prisma/client from the SQLite or
// PostgreSQL schema before Next.js starts. Both schemas expose identical models,
// so the application keeps one typed import while the generated provider changes.
const databaseLocation = resolveDatabaseLocation();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaDatasourceUrl: string | undefined;
};

if (
  globalForPrisma.prisma &&
  globalForPrisma.prismaDatasourceUrl &&
  globalForPrisma.prismaDatasourceUrl !== databaseLocation.datasourceUrl
) {
  throw new Error(
    "DATABASE_URL changed while the server was running. Restart the server to prevent cross-database reads and writes.",
  );
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseLocation.datasourceUrl,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

export const databaseFilePath = databaseLocation.filePath;

if (!globalForPrisma.prisma && databaseFilePath && process.env.NODE_ENV === "development") {
  console.info(`[database] Prisma SQLite file: ${databaseFilePath}`);
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaDatasourceUrl = databaseLocation.datasourceUrl;
}
