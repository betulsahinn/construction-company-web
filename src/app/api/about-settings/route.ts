import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ABOUT_SETTINGS_ID } from "@/lib/site-settings";
import { revalidateStudioContent } from "@/lib/revalidate";

const aboutSettingsSchema = z.object({
  eyebrowTr: z.string().nullable().optional(),
  eyebrowEn: z.string().nullable().optional(),
  titleTr: z.string().nullable().optional(),
  titleEn: z.string().nullable().optional(),
  descriptionTr: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  approachLabelTr: z.string().nullable().optional(),
  approachLabelEn: z.string().nullable().optional(),
  approachTitleTr: z.string().nullable().optional(),
  approachTitleEn: z.string().nullable().optional(),
  materialTitleTr: z.string().nullable().optional(),
  materialTitleEn: z.string().nullable().optional(),
  materialTextTr: z.string().nullable().optional(),
  materialTextEn: z.string().nullable().optional(),
  proportionTitleTr: z.string().nullable().optional(),
  proportionTitleEn: z.string().nullable().optional(),
  proportionTextTr: z.string().nullable().optional(),
  proportionTextEn: z.string().nullable().optional(),
  narrativeTitleTr: z.string().nullable().optional(),
  narrativeTitleEn: z.string().nullable().optional(),
  narrativeTextTr: z.string().nullable().optional(),
  narrativeTextEn: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = aboutSettingsSchema.parse(body);

    const settings = await prisma.aboutPage.upsert({
      where: { id: ABOUT_SETTINGS_ID },
      update: data,
      create: {
        id: ABOUT_SETTINGS_ID,
        ...data,
      },
    });

    revalidateStudioContent();

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update about settings" }, { status: 500 });
  }
}
