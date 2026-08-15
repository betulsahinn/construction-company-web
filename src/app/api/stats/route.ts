import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const [totalProjects, publishedProjects, draftProjects, totalImages, featuredProjects] =
      await Promise.all([
        prisma.project.count(),
        prisma.project.count({ where: { published: true } }),
        prisma.project.count({ where: { published: false } }),
        prisma.projectImage.count(),
        prisma.project.count({ where: { featured: true } }),
      ]);

    return NextResponse.json({
      totalProjects,
      publishedProjects,
      draftProjects,
      totalImages,
      featuredProjects,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
