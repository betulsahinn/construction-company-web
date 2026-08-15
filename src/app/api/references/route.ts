import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidateStudioContent } from "@/lib/revalidate";

const referenceSchema = z.object({
  companyName: z.string().min(1),
  websiteUrl: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  published: z.boolean().optional(),
});

async function getNextSortOrder() {
  const result = await prisma.reference.aggregate({ _max: { sortOrder: true } });
  return (result._max.sortOrder ?? -1) + 1;
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = referenceSchema.parse(body);

    const reference = await prisma.reference.create({
      data: {
        companyName: data.companyName,
        websiteUrl: data.websiteUrl || null,
        sortOrder: data.sortOrder ?? (await getNextSortOrder()),
        published: data.published ?? false,
      },
    });

    revalidateStudioContent();

    return NextResponse.json(reference, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create reference" }, { status: 500 });
  }
}
