import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { deleteImage } from "@/lib/storage";
import { revalidateStudioContent } from "@/lib/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;

    const image = await prisma.projectImage.findUnique({ where: { id } });
    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const urls = new Set(
      [image.url, image.originalUrl, image.webUrl, image.thumbnailUrl].filter(
        (url): url is string => Boolean(url),
      ),
    );

    for (const url of urls) {
      await deleteImage(url);
    }

    await prisma.projectImage.delete({ where: { id } });
    revalidateStudioContent();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
