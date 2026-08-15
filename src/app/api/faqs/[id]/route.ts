import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { deleteFaq, updateFaq } from "@/lib/faq-service";
import { faqSchema } from "@/lib/faq-schema";
import { revalidateStudioContent } from "@/lib/revalidate";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const faq = await updateFaq(id, faqSchema.parse(await request.json()));
    if (!faq) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    revalidateStudioContent(["/faq", "/admin/faqs"]);
    return NextResponse.json(faq);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "All FAQ fields are required." }, { status: 400 });
    if (error instanceof Error && error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[faq:update] failed", error);
    return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    if (!(await deleteFaq(id))) return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    revalidateStudioContent(["/faq", "/admin/faqs"]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[faq:delete] failed", error);
    return NextResponse.json({ error: "Failed to delete FAQ" }, { status: 500 });
  }
}
