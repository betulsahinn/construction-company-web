import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createSlug } from "@/lib/slug";
import { revalidateStudioContent } from "@/lib/revalidate";

const categorySchema = z.object({
  nameTr: z.string().min(1),
  nameEn: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

async function getNextSortOrder() {
  const result = await prisma.category.aggregate({ _max: { sortOrder: true } });
  return (result._max.sortOrder ?? -1) + 1;
}

async function getUniqueCategorySlug(baseValue: string) {
  const baseSlug = createSlug(baseValue);
  let slug = baseSlug;
  let counter = 2;

  while (await prisma.category.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

export async function GET() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = categorySchema.parse(body);
    const name = data.nameTr.trim();
    const slug = await getUniqueCategorySlug(name);

    const category = await prisma.category.create({
      data: {
        name,
        nameTr: name,
        nameEn: data.nameEn?.trim() || null,
        slug,
        sortOrder: data.sortOrder ?? (await getNextSortOrder()),
      },
      include: { _count: { select: { projects: true } } },
    });

    revalidateStudioContent();

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Turkish category label is required." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create category. Category names must be unique." }, { status: 500 });
  }
}
