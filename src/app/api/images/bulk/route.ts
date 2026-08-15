import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateStudioContent } from "@/lib/revalidate";
import { deleteStoredFile } from "@/lib/storage";

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const { ids } = bulkDeleteSchema.parse(await request.json());
    const uniqueIds = [...new Set(ids)];
    const images = await prisma.projectImage.findMany({ where: { id: { in: uniqueIds } } });

    if (images.length !== uniqueIds.length) {
      return NextResponse.json(
        { error: "One or more selected images no longer exist. Refresh and try again." },
        { status: 404 },
      );
    }

    const urls = new Set<string>();
    for (const image of images) {
      for (const url of [image.url, image.originalUrl, image.webUrl, image.thumbnailUrl]) {
        if (url) urls.add(url);
      }
    }

    const cleanupResults = await Promise.allSettled([...urls].map(deleteStoredFile));
    const cleanupFailures = cleanupResults.filter((result) => result.status === "rejected");
    if (cleanupFailures.length > 0) {
      console.error("[project-images:bulk-delete] storage cleanup failed", {
        imageIds: uniqueIds,
        failures: cleanupFailures.map((result) => result.reason),
      });
      return NextResponse.json(
        { error: `Could not remove ${cleanupFailures.length} stored file(s). No database records were deleted.` },
        { status: 502 },
      );
    }

    const result = await prisma.projectImage.deleteMany({ where: { id: { in: uniqueIds } } });
    if (result.count !== uniqueIds.length) {
      console.error("[project-images:bulk-delete] unexpected database delete count", {
        expected: uniqueIds.length,
        actual: result.count,
      });
      return NextResponse.json({ error: "Some image records could not be deleted." }, { status: 500 });
    }

    revalidateStudioContent();
    return NextResponse.json({ success: true, deletedIds: uniqueIds, count: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Select at least one valid image." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[project-images:bulk-delete] failed", error);
    return NextResponse.json({ error: "Bulk image deletion failed." }, { status: 500 });
  }
}
