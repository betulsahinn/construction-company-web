import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { createFaq, listFaqs } from "@/lib/faq-service";
import { revalidateStudioContent } from "@/lib/revalidate";
import { faqSchema } from "@/lib/faq-schema";

export async function GET(request: NextRequest) {
  const admin = request.nextUrl.searchParams.get("admin") === "true";
  if (admin) {
    try { await requireAuth(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  }
  return NextResponse.json(await listFaqs(!admin));
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const data = faqSchema.parse(await request.json());
    const faq = await createFaq(data);
    revalidateStudioContent(["/faq", "/admin/faqs"]);
    return NextResponse.json(faq, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "All FAQ fields are required." }, { status: 400 });
    if (error instanceof Error && error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[faq:create] failed", error);
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }
}
