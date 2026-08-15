import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createSlug, ensureUniqueSlug } from "@/lib/slug";
import { revalidateStudioContent } from "@/lib/revalidate";

const projectSchema = z.object({
  title: z.string().min(1),
  titleTr: z.string().nullable().optional(),
  titleEn: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  descriptionTr: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  categoryIds: z.array(z.string()).optional(),
  pdfUrl: z.string().nullable().optional(),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

async function getNextSortOrder() {
  const result = await prisma.project.aggregate({ _max: { sortOrder: true } });
  return (result._max.sortOrder ?? 0) + 1;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const publishedOnly = searchParams.get("published") === "true";
  const admin = searchParams.get("admin") === "true";

  if (admin) {
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const projects = await prisma.project.findMany({
    // Unauthenticated callers must never be able to enumerate drafts.
    where: !admin || publishedOnly ? { published: true } : undefined,
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      categories: { include: { category: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = projectSchema.parse(body);

    const baseSlug = createSlug(data.slug || data.titleTr || data.titleEn || data.title);
    const slug = await ensureUniqueSlug(baseSlug);
    const sortOrder = data.sortOrder ?? (await getNextSortOrder());
    const categoryIds = [...new Set(data.categoryIds ?? [])];
    const selectedCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (selectedCategories.length !== categoryIds.length) {
      return NextResponse.json({ error: "One or more selected categories do not exist" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        title: data.title,
        titleTr: data.titleTr ?? data.title,
        titleEn: data.titleEn ?? null,
        slug,
        description: data.description ?? null,
        descriptionTr: data.descriptionTr ?? data.description ?? null,
        descriptionEn: data.descriptionEn ?? null,
        location: data.location ?? null,
        year: data.year ?? null,
        category: selectedCategories[0]?.name ?? null,
        pdfUrl: data.pdfUrl ?? null,
        featured: data.featured ?? false,
        published: data.published ?? false,
        sortOrder,
        categories: selectedCategories.length
          ? {
              create: selectedCategories.map((category) => ({
                category: { connect: { id: category.id } },
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: { include: { category: true } },
      },
    });

    revalidateStudioContent([`/projects/${project.slug}`]);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
