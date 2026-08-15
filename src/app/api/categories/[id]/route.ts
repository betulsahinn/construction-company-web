import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createSlug } from "@/lib/slug";
import { revalidateStudioContent } from "@/lib/revalidate";

const categorySchema = z.object({
  nameTr: z.string().min(1).optional(),
  nameEn: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

async function getUniqueCategorySlug(baseValue: string, excludeId: string) {
  const baseSlug = createSlug(baseValue);
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const data = categorySchema.parse(body);
    const existing = await prisma.category.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const nameTr = data.nameTr?.trim() || existing.nameTr || existing.name;
    const slug = data.nameTr ? await getUniqueCategorySlug(nameTr, id) : existing.slug;

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: nameTr,
        nameTr,
        ...(data.nameEn !== undefined && { nameEn: data.nameEn?.trim() || null }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        slug,
      },
      include: { _count: { select: { projects: true } } },
    });

    revalidateStudioContent();

    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid category input" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update category. Category names must be unique." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { projects: true } } },
    });

    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (category._count.projects > 0) {
      return NextResponse.json(
        { error: "This category is used by projects and cannot be deleted." },
        { status: 409 },
      );
    }

    await prisma.category.delete({ where: { id } });
    revalidateStudioContent();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
