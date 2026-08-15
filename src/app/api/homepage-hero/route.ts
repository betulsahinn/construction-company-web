import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidateStudioContent } from "@/lib/revalidate";

const HERO_ID = "homepage";

const heroSchema = z.object({
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  ctaLabel: z.string().nullable().optional(),
  ctaUrl: z.string().nullable().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = heroSchema.parse(body);

    const hero = await prisma.homepageHero.upsert({
      where: { id: HERO_ID },
      update: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
        ...(data.ctaLabel !== undefined && { ctaLabel: data.ctaLabel }),
        ...(data.ctaUrl !== undefined && { ctaUrl: data.ctaUrl }),
        ...(data.mediaType !== undefined && { mediaType: data.mediaType }),
      },
      create: {
        id: HERO_ID,
        title: data.title ?? null,
        subtitle: data.subtitle ?? null,
        ctaLabel: data.ctaLabel ?? null,
        ctaUrl: data.ctaUrl ?? null,
        mediaType: data.mediaType ?? "image",
      },
    });

    revalidateStudioContent();

    return NextResponse.json(hero);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update homepage hero" }, { status: 500 });
  }
}
