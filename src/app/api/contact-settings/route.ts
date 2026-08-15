import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { CONTACT_SETTINGS_ID } from "@/lib/site-settings";
import { revalidateStudioContent } from "@/lib/revalidate";

const contactSettingsSchema = z.object({
  businessName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  instagramUrl: z.string().nullable().optional(),
  instagramHandle: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  mapsUrl: z.string().nullable().optional(),
  titleTr: z.string().nullable().optional(),
  titleEn: z.string().nullable().optional(),
  introTr: z.string().nullable().optional(),
  introEn: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const data = contactSettingsSchema.parse(body);

    const settings = await prisma.contactPage.upsert({
      where: { id: CONTACT_SETTINGS_ID },
      update: data,
      create: {
        id: CONTACT_SETTINGS_ID,
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
    return NextResponse.json({ error: "Failed to update contact settings" }, { status: 500 });
  }
}
