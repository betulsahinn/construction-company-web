import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { FOOTER_SETTINGS_ID } from "@/lib/site-settings";
import { revalidateStudioContent } from "@/lib/revalidate";

const footerSettingsSchema = z.object({
  brandTitleTr: z.string().nullable().optional(),
  brandTitleEn: z.string().nullable().optional(),
  descriptionTr: z.string().nullable().optional(),
  descriptionEn: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  mapsUrl: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  instagramUrl: z.string().nullable().optional(),
  instagramHandle: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = footerSettingsSchema.parse(body);

    const settings = await prisma.footerSettings.upsert({
      where: { id: FOOTER_SETTINGS_ID },
      update: data,
      create: {
        id: FOOTER_SETTINGS_ID,
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
    return NextResponse.json({ error: "Failed to update footer settings" }, { status: 500 });
  }
}
