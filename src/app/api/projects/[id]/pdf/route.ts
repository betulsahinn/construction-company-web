import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { assertUploadRequestSize, deleteStoredFile, MAX_PDF_UPLOAD_SIZE, uploadPdf } from "@/lib/storage";
import { revalidateStudioContent } from "@/lib/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    assertUploadRequestSize(request, MAX_PDF_UPLOAD_SIZE, "PDF file size must be 200MB or less.");
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const pdfUrl = await uploadPdf(file);

    if (project.pdfUrl) {
      await deleteStoredFile(project.pdfUrl);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { pdfUrl },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    revalidateStudioContent([`/projects/${project.slug}`, `/admin/projects/${project.id}/edit`]);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "PDF upload failed" }, { status: 500 });
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

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "PDF delete failed" }, { status: 500 });
  }
}
