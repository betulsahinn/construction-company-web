import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateProjectImageAlt } from "@/lib/image-alt";
import { prisma } from "@/lib/prisma";
import { revalidateStudioContent } from "@/lib/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: { include: { category: true } },
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const categories = project.categories.map(({ category }) => category);
    await prisma.$transaction(
      project.images.map((image, index) => prisma.projectImage.update({
        where: { id: image.id },
        data: {
          alt: generateProjectImageAlt({
            title: project.title,
            titleTr: project.titleTr,
            titleEn: project.titleEn,
            categories,
            order: index + 1,
            force: true,
          }),
        },
      })),
    );

    const images = await prisma.projectImage.findMany({ where: { projectId: id }, orderBy: { sortOrder: "asc" } });
    revalidateStudioContent([`/projects/${project.slug}`, `/admin/projects/${id}/edit`]);
    return NextResponse.json({ images, count: images.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[project-images:regenerate-alts] failed", error);
    return NextResponse.json({ error: "Failed to regenerate image alt texts" }, { status: 500 });
  }
}
