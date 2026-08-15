import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { assertUploadRequestSize, deleteStoredFile, MAX_IMAGE_UPLOAD_SIZE, uploadImage } from "@/lib/storage";
import { revalidateStudioContent } from "@/lib/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    assertUploadRequestSize(request, MAX_IMAGE_UPLOAD_SIZE, "Image file size must be 200MB or less.");
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Logo file is required" }, { status: 400 });
    }

    const existing = await prisma.reference.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }

    const logoAsset = await uploadImage(file);
    await deleteReferenceLogoFiles(existing);

    const reference = await prisma.reference.update({
      where: { id },
      data: {
        logoUrl: logoAsset.webUrl,
        logoOriginalUrl: logoAsset.originalUrl,
        logoWebUrl: logoAsset.webUrl,
        logoThumbnailUrl: logoAsset.thumbnailUrl,
        logoFileSize: logoAsset.fileSize,
        logoWidth: logoAsset.width,
        logoHeight: logoAsset.height,
        logoMimeType: logoAsset.mimeType,
      },
    });

    revalidateStudioContent();

    return NextResponse.json(reference);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Reference logo upload failed" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const existing = await prisma.reference.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }

    await deleteReferenceLogoFiles(existing);

    const reference = await prisma.reference.update({
      where: { id },
      data: {
        logoUrl: null,
        logoOriginalUrl: null,
        logoWebUrl: null,
        logoThumbnailUrl: null,
        logoFileSize: null,
        logoWidth: null,
        logoHeight: null,
        logoMimeType: null,
      },
    });

    revalidateStudioContent();

    return NextResponse.json(reference);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Reference logo delete failed" }, { status: 500 });
  }
}

async function deleteReferenceLogoFiles(reference: NonNullable<Awaited<ReturnType<typeof prisma.reference.findUnique>>>) {
  const urls = new Set(
    [reference.logoUrl, reference.logoOriginalUrl, reference.logoWebUrl, reference.logoThumbnailUrl].filter(
      (url): url is string => Boolean(url),
    ),
  );

  for (const url of urls) {
    await deleteStoredFile(url);
  }
}
