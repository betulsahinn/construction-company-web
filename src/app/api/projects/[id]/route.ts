import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createSlug, ensureUniqueSlug } from "@/lib/slug";
import { deleteStoredFile } from "@/lib/storage";
import { revalidateStudioContent } from "@/lib/revalidate";

const projectSchema = z.object({
  title: z.string().min(1).optional(),
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

type RouteParams = { params: Promise<{ id: string }> };

function checkboxBoolean(value: unknown) {
  return value === true || value === "true" || value === "on";
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const admin = request.nextUrl.searchParams.get("admin") === "true";

  if (admin) {
    try {
      await requireAuth();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id }, { slug: id }],
      ...(!admin && { published: true }),
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      categories: { include: { category: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const body: unknown = await request.json();
    const normalizedBody = body && typeof body === "object"
      ? {
          ...body,
          // Unchecked HTML checkboxes are absent. Missing must therefore mean false.
          featured: checkboxBoolean((body as Record<string, unknown>).featured),
          published: checkboxBoolean((body as Record<string, unknown>).published),
        }
      : body;
    const data = projectSchema.parse(normalizedBody);

    if (process.env.NODE_ENV === "development") {
      console.info("[project:update] incoming flags", {
        id,
        published: data.published,
        featured: data.featured,
      });
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let slug = existing.slug;
    if (data.slug !== undefined) {
      const slugSource = data.slug?.trim() || data.titleTr || data.titleEn || data.title || existing.title;
      const normalizedSlug = createSlug(slugSource);
      if (normalizedSlug !== existing.slug) {
        slug = await ensureUniqueSlug(normalizedSlug, id);
      }
    }

    const selectedCategories = data.categoryIds === undefined
      ? null
      : await prisma.category.findMany({
          where: { id: { in: [...new Set(data.categoryIds)] } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        });
    if (selectedCategories && selectedCategories.length !== new Set(data.categoryIds).size) {
      return NextResponse.json({ error: "One or more selected categories do not exist" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.titleTr !== undefined && { titleTr: data.titleTr }),
        ...(data.titleEn !== undefined && { titleEn: data.titleEn }),
        slug,
        ...(data.description !== undefined && { description: data.description }),
        ...(data.descriptionTr !== undefined && { descriptionTr: data.descriptionTr }),
        ...(data.descriptionEn !== undefined && { descriptionEn: data.descriptionEn }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.year !== undefined && { year: data.year }),
        ...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl }),
        featured: data.featured ?? false,
        published: data.published ?? false,
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(selectedCategories !== null && {
          category: selectedCategories[0]?.name ?? null,
          categories: {
            deleteMany: {},
            create: selectedCategories.map((category) => ({
              category: { connect: { id: category.id } },
            })),
          },
        }),
      },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: { include: { category: true } },
      },
    });

    revalidateStudioContent([
      `/projects/${existing.slug}`,
      `/projects/${project.slug}`,
      `/admin/projects/${project.id}/edit`,
    ]);

    if (process.env.NODE_ENV === "development") {
      console.info("[project:update] saved flags", {
        id: project.id,
        slug: project.slug,
        published: project.published,
        featured: project.featured,
      });
    }

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[project:update] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const storedUrls = new Set<string>();
    for (const image of project.images) {
      for (const url of [image.url, image.originalUrl, image.webUrl, image.thumbnailUrl]) {
        if (url) storedUrls.add(url);
      }
    }
    if (project.pdfUrl) storedUrls.add(project.pdfUrl);

    // Delete the database record first. Image relations are removed by the
    // schema cascade, so a storage-provider outage cannot resurrect/block it.
    await prisma.project.delete({ where: { id } });

    const cleanupResults = await Promise.allSettled([...storedUrls].map((url) => deleteStoredFile(url)));
    const cleanupFailures = cleanupResults.filter((result) => result.status === "rejected").length;
    if (cleanupFailures > 0) {
      console.warn("[project:delete] database row deleted; some stored files could not be removed", {
        id,
        cleanupFailures,
      });
    }

    revalidateStudioContent([`/projects/${project.slug}`]);

    return NextResponse.json({ success: true, cleanupFailures });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[project:delete] failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
