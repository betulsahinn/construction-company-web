import path from "path";

export type DatabaseLocation = {
  datasourceUrl: string;
  filePath: string | null;
};

/**
 * Prisma resolves relative SQLite URLs from the schema directory. Passing an
 * absolute URL at runtime removes any ambiguity between Next.js, scripts, and
 * different process working directories.
 */
export function resolveDatabaseLocation(databaseUrl = process.env.DATABASE_URL): DatabaseLocation {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!databaseUrl.startsWith("file:")) {
    return { datasourceUrl: databaseUrl, filePath: null };
  }

  const value = databaseUrl.slice("file:".length);
  const queryIndex = value.indexOf("?");
  const rawFilePath = queryIndex === -1 ? value : value.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : value.slice(queryIndex);

  if (rawFilePath === ":memory:") {
    return { datasourceUrl: databaseUrl, filePath: null };
  }

  const decodedFilePath = decodeURIComponent(rawFilePath);
  const filePath = path.isAbsolute(decodedFilePath)
    ? path.normalize(decodedFilePath)
    : path.resolve(process.cwd(), "prisma", decodedFilePath);
  const prismaFilePath = filePath.replace(/\\/g, "/");

  return {
    datasourceUrl: `file:${prismaFilePath}${query}`,
    filePath,
  };
}
