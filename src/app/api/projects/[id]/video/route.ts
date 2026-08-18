import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createPresignedR2PutUrl, getR2KeyFromPublicUrl, r2ObjectExists } from "@/lib/r2";
import {
  MAX_VIDEO_UPLOAD_SIZE,
  VIDEO_UPLOAD_ERROR_MESSAGE,
  allowedVideoMimeTypes,
  deleteStoredFile,
  validateVideoUpload,
} from "@/lib/storage";
import { revalidateStudioContent } from "@/lib/revalidate";

type RouteParams = { params: Promise<{ id: string }> };
const PROJECT_VIDEO_PREFIX = "project-videos";

const presignSchema = z.object({
  action: z.literal("presign"),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
});

const saveSchema = z.object({
  action: z.literal("save"),
  videoUrl: z.string().url(),
});

const requestSchema = z.discriminatedUnion("action", [presignSchema, saveSchema]);

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const data = requestSchema.parse(await request.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (data.action === "presign") {
      validateVideoUpload(data.contentType, data.fileSize);
      let upload: Awaited<ReturnType<typeof createPresignedR2PutUrl>>;
      try {
        upload = await createPresignedR2PutUrl({
          contentType: data.contentType,
          originalFilename: data.filename,
          prefix: PROJECT_VIDEO_PREFIX,
        });
      } catch (error) {
        console.error("[project-video:presign] failed", {
          projectId: id,
          contentType: data.contentType,
          fileSize: data.fileSize,
          error: error instanceof Error ? error.message : "Unknown presign error",
        });
        return NextResponse.json(
          { error: "Unable to create project video upload URL. Check R2 endpoint, bucket, credentials, and token permissions." },
          { status: 500 },
        );
      }

      return NextResponse.json({
        uploadUrl: upload.uploadUrl,
        videoUrl: upload.url,
        maxSize: MAX_VIDEO_UPLOAD_SIZE,
        allowedMimeTypes: allowedVideoMimeTypes,
      });
    }

    const key = getR2KeyFromPublicUrl(data.videoUrl);
    if (!key || !key.startsWith(`${PROJECT_VIDEO_PREFIX}/`)) {
      return NextResponse.json({ error: "Invalid project video URL" }, { status: 400 });
    }
    if (!(await r2ObjectExists(key))) {
      return NextResponse.json({ error: "Uploaded project video could not be found" }, { status: 400 });
    }

    if (project.pdfUrl && project.pdfUrl !== data.videoUrl) {
      await deleteStoredFile(project.pdfUrl);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { pdfUrl: data.videoUrl },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    }).catch(async (error) => {
      await deleteStoredFile(data.videoUrl).catch(() => undefined);
      throw error;
    });

    revalidateStudioContent([`/projects/${project.slug}`, `/admin/projects/${project.id}/edit`]);

    return NextResponse.json({ ...updated, videoUrl: updated.pdfUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Video upload failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.pdfUrl) {
      await deleteStoredFile(project.pdfUrl);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { pdfUrl: null },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    revalidateStudioContent([`/projects/${project.slug}`, `/admin/projects/${project.id}/edit`]);

    return NextResponse.json({ ...updated, videoUrl: updated.pdfUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === VIDEO_UPLOAD_ERROR_MESSAGE) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Video delete failed" }, { status: 500 });
  }
}
