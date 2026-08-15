import { randomUUID } from "crypto";
import path from "path";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type R2UploadOptions = {
  contentType: string;
  originalFilename?: string;
  prefix?: string;
  key?: string;
};

export type R2UploadResult = {
  key: string;
  url: string;
};

type R2Config = {
  bucketName: string;
  endpoint: string;
  publicBaseUrl: string;
};

let client: S3Client | undefined;

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required R2 environment variable: ${name}`);
  return value;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getR2Config(): R2Config {
  const accountId = requireEnvironmentVariable("CLOUDFLARE_R2_ACCOUNT_ID");
  const endpoint = withoutTrailingSlash(requireEnvironmentVariable("CLOUDFLARE_R2_ENDPOINT"));
  const bucketName = requireEnvironmentVariable("CLOUDFLARE_R2_BUCKET_NAME");
  const publicBaseUrl = withoutTrailingSlash(requireEnvironmentVariable("CLOUDFLARE_R2_PUBLIC_URL"));

  if (!endpoint.includes(accountId)) {
    console.warn("[r2] CLOUDFLARE_R2_ENDPOINT does not contain CLOUDFLARE_R2_ACCOUNT_ID");
  }

  return { bucketName, endpoint, publicBaseUrl };
}

function getConfiguredR2Client(config: R2Config): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: requireEnvironmentVariable("CLOUDFLARE_R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnvironmentVariable("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return client;
}

/** Returns the shared, lazily configured S3-compatible R2 client. */
export function getR2Client(): S3Client {
  return getConfiguredR2Client(getR2Config());
}

function createObjectKey(options: R2UploadOptions): string {
  if (options.key) return options.key.replace(/^\/+/, "");

  const extension = options.originalFilename
    ? path.extname(options.originalFilename).toLowerCase().replace(/[^.a-z0-9]/g, "")
    : "";
  const prefix = (options.prefix ?? "uploads").replace(/^\/+|\/+$/g, "");
  return `${prefix}/${randomUUID()}${extension}`;
}

function publicUrlForKey(key: string, config: R2Config): string {
  return `${config.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function getR2PublicUrl(key: string): string {
  return publicUrlForKey(key.replace(/^\/+/, ""), getR2Config());
}

export async function r2ObjectExists(key: string): Promise<boolean> {
  const config = getR2Config();

  try {
    await getConfiguredR2Client(config).send(
      new HeadObjectCommand({ Bucket: config.bucketName, Key: key.replace(/^\/+/, "") }),
    );
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    const name = (error as { name?: string }).name;
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return false;
    throw error;
  }
}

function keyFromUrlOrKey(urlOrKey: string, config: R2Config): string | null {
  if (!/^https?:\/\//i.test(urlOrKey)) return urlOrKey.replace(/^\/+/, "") || null;

  const prefix = `${config.publicBaseUrl}/`;
  if (!urlOrKey.startsWith(prefix)) return null;
  return decodeURIComponent(urlOrKey.slice(prefix.length));
}

export async function uploadToR2(
  body: Buffer | Uint8Array,
  options: R2UploadOptions,
): Promise<R2UploadResult> {
  const config = getR2Config();
  const key = createObjectKey(options);

  try {
    await getConfiguredR2Client(config).send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    console.error("[r2:upload] failed", { key, error });
    throw new Error("Unable to upload file to Cloudflare R2", { cause: error });
  }

  return { key, url: publicUrlForKey(key, config) };
}

export async function deleteFromR2(urlOrKey: string): Promise<void> {
  const config = getR2Config();
  const key = keyFromUrlOrKey(urlOrKey, config);
  if (!key) return;

  try {
    await getConfiguredR2Client(config).send(
      new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }),
    );
  } catch (error) {
    console.error("[r2:delete] failed", { key, error });
    throw new Error("Unable to delete file from Cloudflare R2", { cause: error });
  }
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET_NAME &&
      process.env.CLOUDFLARE_R2_ENDPOINT &&
      process.env.CLOUDFLARE_R2_PUBLIC_URL,
  );
}
