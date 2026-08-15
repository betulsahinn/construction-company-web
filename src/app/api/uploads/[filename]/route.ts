import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { filename } = await params;

  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const roots = [process.cwd(), process.env.INIT_CWD]
    .filter((root): root is string => Boolean(root))
    .map((root) => path.join(root, "public", "uploads"));

  for (const uploadRoot of roots) {
    try {
      const filePath = path.join(uploadRoot, filename);
      const body = await readFile(filePath);
      const contentType = contentTypes[path.extname(filename).toLowerCase()] ?? "application/octet-stream";

      return new NextResponse(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Try the next plausible project root.
    }
  }

  return new NextResponse("Not found", { status: 404 });
}
