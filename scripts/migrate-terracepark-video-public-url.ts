import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { loadEnvConfig } from "@next/env";
import { Prisma, PrismaClient } from "@prisma/client";

loadEnvConfig(process.cwd());

const EXPECTED_PROJECT_ID = "cmsxe3a990000vqdogl9e46q4";
const EXPECTED_PROJECT_SLUG = "terracepark51";
const EXPECTED_PROJECT_TITLE = "TerracePark51";
const EXPECTED_R2_BUCKET = "turkuvaz-insaat";
const OLD_TURKUVAZ_R2_PUBLIC_URL = "https://pub-c6b041d39e1b4bfab50101c0171e1b06.r2.dev";
const NEW_R2_PUBLIC_URL = "https://cdn.turkuvazinsaat.com";
const EXPECTED_VIDEO_KEY = "project-videos/3660aebe-5a37-4f03-a3c8-a96c078b915a.mp4";
const EXPECTED_OLD_URL = `${OLD_TURKUVAZ_R2_PUBLIC_URL}/${EXPECTED_VIDEO_KEY}`;
const EXPECTED_NEW_URL = `${NEW_R2_PUBLIC_URL}/${EXPECTED_VIDEO_KEY}`;

type Mode = "dry-run" | "execute";
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type ProjectVideoRow = {
  id: string;
  slug: string;
  title: string;
  titleTr: string | null;
  titleEn: string | null;
  pdfUrl: string | null;
};

type Plan = {
  project: ProjectVideoRow | null;
  currentUrl: string | null;
  nextUrl: string | null;
  key: string | null;
  objectExists: boolean;
  currentHostname: string | null;
  newHostname: string;
  cdnHeadStatus: number | null;
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

function extractR2KeyFromExpectedOldUrl(value: string | null): string | null {
  if (!value || !hasBase(value, OLD_TURKUVAZ_R2_PUBLIC_URL)) return null;
  return decodeURIComponent(value.slice(OLD_TURKUVAZ_R2_PUBLIC_URL.length).replace(/^\/+/, "")) || null;
}

function hostnameForUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function projectLooksLikeTerracePark(project: ProjectVideoRow): boolean {
  return (
    project.id === EXPECTED_PROJECT_ID &&
    project.slug === EXPECTED_PROJECT_SLUG &&
    [project.title, project.titleTr, project.titleEn].some((title) => title === EXPECTED_PROJECT_TITLE)
  );
}

async function readProject(client: DatabaseClient): Promise<ProjectVideoRow | null> {
  const projects = await client.project.findMany({
    where: {
      OR: [{ id: EXPECTED_PROJECT_ID }, { slug: EXPECTED_PROJECT_SLUG }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      titleTr: true,
      titleEn: true,
      pdfUrl: true,
    },
    orderBy: { id: "asc" },
  });

  if (projects.length > 1) {
    throw new Error(`Refusing migration because ${projects.length} projects matched TerracePark51 id/slug.`);
  }

  return projects[0] ?? null;
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

async function cdnHeadStatus(): Promise<number | null> {
  try {
    const response = await fetch(EXPECTED_NEW_URL, { method: "HEAD" });
    return response.status;
  } catch {
    return null;
  }
}

async function buildPlan(prisma: PrismaClient, r2: S3Client, bucketName: string): Promise<Plan> {
  const project = await readProject(prisma);
  const unsafeReasons: string[] = [];
  let key: string | null = null;
  let exists = false;

  if (!project) {
    unsafeReasons.push(`Project not found by id ${EXPECTED_PROJECT_ID} or slug ${EXPECTED_PROJECT_SLUG}.`);
  } else {
    if (!projectLooksLikeTerracePark(project)) {
      unsafeReasons.push(`Matched project is not the expected TerracePark51 row: ${project.id} / ${project.slug}.`);
    }

    if (project.pdfUrl !== EXPECTED_OLD_URL) {
      unsafeReasons.push("Current Project.pdfUrl does not exactly match the expected old Turkuvaz R2 URL.");
    }

    key = extractR2KeyFromExpectedOldUrl(project.pdfUrl);
    if (!key) {
      unsafeReasons.push("Could not extract a project-videos R2 key from the current Project.pdfUrl.");
    } else if (key !== EXPECTED_VIDEO_KEY) {
      unsafeReasons.push(`Extracted key ${key} does not match expected key ${EXPECTED_VIDEO_KEY}.`);
    } else {
      exists = await objectExists(r2, bucketName, key);
      if (!exists) unsafeReasons.push(`Missing R2 object in ${EXPECTED_R2_BUCKET}: ${key}`);
    }
  }

  return {
    project,
    currentUrl: project?.pdfUrl ?? null,
    nextUrl: project?.pdfUrl === EXPECTED_OLD_URL ? EXPECTED_NEW_URL : null,
    key,
    objectExists: exists,
    currentHostname: hostnameForUrl(project?.pdfUrl ?? null),
    newHostname: new URL(NEW_R2_PUBLIC_URL).hostname,
    cdnHeadStatus: key === EXPECTED_VIDEO_KEY ? await cdnHeadStatus() : null,
    unsafeReasons,
  };
}

function safeToMigrate(plan: Plan): boolean {
  return Boolean(
    plan.project &&
      plan.currentUrl === EXPECTED_OLD_URL &&
      plan.nextUrl === EXPECTED_NEW_URL &&
      plan.key === EXPECTED_VIDEO_KEY &&
      plan.objectExists &&
      plan.unsafeReasons.length === 0,
  );
}

async function executeMigration(prisma: PrismaClient, plan: Plan): Promise<number> {
  if (!safeToMigrate(plan)) throw new Error("Refusing execute mode because safety checks did not pass.");

  return prisma.$transaction(
    async (transaction) => {
      const current = await readProject(transaction);
      if (!current || !projectLooksLikeTerracePark(current)) {
        throw new Error("TerracePark51 project verification failed inside transaction.");
      }
      if (current.pdfUrl !== EXPECTED_OLD_URL) {
        throw new Error("TerracePark51 Project.pdfUrl changed after dry-run planning; aborting transaction.");
      }

      const updated = await transaction.project.updateMany({
        where: {
          id: EXPECTED_PROJECT_ID,
          slug: EXPECTED_PROJECT_SLUG,
          pdfUrl: EXPECTED_OLD_URL,
        },
        data: { pdfUrl: EXPECTED_NEW_URL },
      });

      if (updated.count !== 1) {
        throw new Error(`Expected to update exactly 1 TerracePark51 row, updated ${updated.count}.`);
      }

      return updated.count;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 120_000 },
  );
}

function printPlan(plan: Plan): void {
  console.log("\nDry-run plan");
  console.log(
    `Project checked: ${
      plan.project ? `${plan.project.id} / ${plan.project.slug} / ${plan.project.title}` : "not found"
    }`,
  );
  console.log(`Current pdfUrl: ${plan.currentUrl ?? "null"}`);
  console.log(`R2 key: ${plan.key ?? "none"}`);
  console.log(`R2 object exists: ${plan.objectExists ? "YES" : "NO"}`);
  console.log(`Current hostname: ${plan.currentHostname ?? "none"}`);
  console.log(`New hostname: ${plan.newHostname}`);
  console.log(`CDN HEAD status: ${plan.cdnHeadStatus ?? "not checked"}`);
  console.log(`Safe to migrate: ${safeToMigrate(plan) ? "YES" : "NO"}`);
  console.log(`Rows that would update: ${safeToMigrate(plan) ? 1 : 0}`);
  console.log("\nBefore/after URL");
  console.log(`before: ${plan.currentUrl ?? "null"}`);
  console.log(`after:  ${plan.nextUrl ?? "not planned"}`);

  if (plan.unsafeReasons.length > 0) {
    console.log("\nUnsafe reasons");
    for (const reason of plan.unsafeReasons) console.log(`- ${reason}`);
  }
}

async function main(): Promise<void> {
  const mode = parseMode();
  const { databaseUrl, bucketName } = requireExpectedEnvironment();
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const r2 = getR2Client();

  console.log(`TerracePark51 project video URL migration (${mode === "execute" ? "EXECUTE" : "DRY RUN"})`);
  console.log(`Database: ${databaseDescription(databaseUrl)}`);
  console.log(`R2 bucket: ${bucketName}`);
  console.log("Scope: Project.pdfUrl for TerracePark51 only");
  console.log("R2 writes/deletes: disabled");

  try {
    const plan = await buildPlan(prisma, r2, bucketName);
    printPlan(plan);

    if (mode === "dry-run") {
      console.log("\nDatabase writes: 0");
      return;
    }

    const updatedRows = await executeMigration(prisma, plan);
    console.log("\nExecution summary");
    console.log(`Rows updated: ${updatedRows}`);
    console.log("R2 writes/deletes: 0");
  } finally {
    await prisma.$disconnect();
    r2.destroy();
  }
}

main().catch((error) => {
  console.error("TerracePark51 video URL migration failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
