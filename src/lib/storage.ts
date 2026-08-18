import { unlink } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { deleteFromR2, isR2Configured, uploadToR2 } from "@/lib/r2";

export const MAX_IMAGE_UPLOAD_SIZE = 200 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_SIZE = 200 * 1024 * 1024;
export const VIDEO_UPLOAD_ERROR_MESSAGE = "Maximum 200MB. Supported: MP4/WebM/MOV.";
const MULTIPART_OVERHEAD_ALLOWANCE = 1024 * 1024;

const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
export const allowedVideoMimeTypes = ["video/mp4", "video/webm", "video/quicktime"];

export type UploadedImageAsset = {
  url: string;
  originalUrl: string;
  webUrl: string;
  thumbnailUrl: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  mimeType: string;
};

export function assertUploadRequestSize(
  request: Request,
  maxFileSize: number,
  message: string,
): void {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxFileSize + MULTIPART_OVERHEAD_ALLOWANCE) {
    throw new Error(message);
  }
}

async function uploadFile(
  file: File,
  allowedMimeTypes: string[],
  maxSize: number,
  sizeErrorMessage: string,
  prefix: string,
): Promise<string> {
  if (!allowedMimeTypes.includes(file.type)) throw new Error("Unsupported file type");
  if (file.size > maxSize) throw new Error(sizeErrorMessage);

  const result = await uploadToR2(Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    originalFilename: file.name,
    prefix,
  });
  return result.url;
}

export async function uploadImage(file: File): Promise<UploadedImageAsset> {
  if (!allowedImageMimeTypes.includes(file.type)) {
    throw new Error("Unsupported image type. Allowed: JPG, JPEG, PNG, WebP.");
  }
  if (file.size > MAX_IMAGE_UPLOAD_SIZE) {
    throw new Error("Image file size must be 200MB or less.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let width: number | null = null;
  let height: number | null = null;

  try {
    const metadata = await sharp(buffer, { failOn: "error" }).metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;
  } catch {
    throw new Error("The uploaded image is invalid or corrupted.");
  }

  const webBuffer = await sharp(buffer, { failOn: "error" })
    .rotate()
    .resize({ width: 2400, withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
  const thumbnailBuffer = await sharp(buffer, { failOn: "error" })
    .rotate()
    .resize({ width: 720, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const uploadedUrls: string[] = [];
  try {
    const original = await uploadToR2(buffer, {
      contentType: file.type,
      originalFilename: file.name,
      prefix: "images/originals",
    });
    uploadedUrls.push(original.url);
    const web = await uploadToR2(webBuffer, {
      contentType: "image/webp",
      originalFilename: `${path.parse(file.name).name}.webp`,
      prefix: "images/web",
    });
    uploadedUrls.push(web.url);
    const thumbnail = await uploadToR2(thumbnailBuffer, {
      contentType: "image/webp",
      originalFilename: `${path.parse(file.name).name}.webp`,
      prefix: "images/thumbnails",
    });
    uploadedUrls.push(thumbnail.url);

    return {
      url: web.url,
      originalUrl: original.url,
      webUrl: web.url,
      thumbnailUrl: thumbnail.url,
      fileSize: file.size,
      width,
      height,
      mimeType: file.type,
    };
  } catch (error) {
    await Promise.allSettled(uploadedUrls.map(deleteFromR2));
    throw error;
  }
}

export async function uploadVideo(file: File): Promise<string> {
  validateVideoUpload(file.type, file.size);

  return uploadFile(
    file,
    allowedVideoMimeTypes,
    MAX_VIDEO_UPLOAD_SIZE,
    VIDEO_UPLOAD_ERROR_MESSAGE,
    "videos",
  );
}

export function validateVideoUpload(mimeType: string, fileSize: number): void {
  if (!allowedVideoMimeTypes.includes(mimeType)) {
    throw new Error(VIDEO_UPLOAD_ERROR_MESSAGE);
  }

  if (fileSize > MAX_VIDEO_UPLOAD_SIZE) {
    throw new Error(VIDEO_UPLOAD_ERROR_MESSAGE);
  }
}

export async function deleteStoredFile(url: string): Promise<void> {
  if (url.startsWith("/uploads/") || url.startsWith("/api/uploads/")) {
    const encodedPath = url.replace(/^\/(?:api\/)?uploads\//, "").split(/[?#]/, 1)[0];
    let relativePath: string;
    try {
      relativePath = decodeURIComponent(encodedPath);
    } catch {
      throw new Error("Invalid local upload URL");
    }

    const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
    const filePath = path.resolve(uploadsRoot, relativePath);
    if (filePath !== uploadsRoot && !filePath.startsWith(`${uploadsRoot}${path.sep}`)) {
      throw new Error("Invalid local upload path");
    }

    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return;
  }

  if (!/^https?:\/\//i.test(url)) return;
  await deleteFromR2(url);
}

export const deleteImage = deleteStoredFile;

export function getStorageInfo() {
  return { provider: "r2" as const, isR2Configured: isR2Configured() };
}
