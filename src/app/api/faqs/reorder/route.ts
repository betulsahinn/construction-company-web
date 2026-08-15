import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { reorderFaqs } from "@/lib/faq-service";
import { revalidateStudioContent } from "@/lib/revalidate";

const schema = z.object({ updates: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).min(1) });

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const { updates } = schema.parse(await request.json());
    await reorderFaqs(updates);
    revalidateStudioContent(["/faq", "/admin/faqs"]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid FAQ order" }, { status: 400 });
    if (error instanceof Error && error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[faq:reorder] failed", error);
    return NextResponse.json({ error: "Failed to reorder FAQs" }, { status: 500 });
  }
}
