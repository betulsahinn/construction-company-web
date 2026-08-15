import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { deleteStoredFile } from "@/lib/storage";
import { revalidateStudioContent } from "@/lib/revalidate";

const referenceSchema = z.object({
  companyName: z.string().min(1).optional(),
  websiteUrl: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  published: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = referenceSchema.parse(body);

    const reference = await prisma.reference.update({
      where: { id },
      data: {
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl || null }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.published !== undefined && { published: data.published }),
      },
    });

    revalidateStudioContent();

    return NextResponse.json(reference);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid reference input" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update reference" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const reference = await prisma.reference.findUnique({ where: { id } });

    if (!reference) {
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }

    await deleteReferenceLogoFiles(reference);
    await prisma.reference.delete({ where: { id } });
    revalidateStudioContent();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete reference" }, { status: 500 });
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
