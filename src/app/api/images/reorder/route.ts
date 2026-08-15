import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidateStudioContent } from "@/lib/revalidate";

const reorderSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string(),
      sortOrder: z.number(),
    }),
  ),
});

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { updates } = reorderSchema.parse(body);

    await prisma.$transaction(
      updates.map(({ id, sortOrder }) =>
        prisma.projectImage.update({
          where: { id },
          data: { sortOrder },
        }),
      ),
    );

    revalidateStudioContent();

    return NextResponse.json({ success: true });
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
