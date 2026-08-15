import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { assertUploadRequestSize, deleteStoredFile, MAX_IMAGE_UPLOAD_SIZE, uploadImage } from "@/lib/storage";
import { revalidateStudioContent } from "@/lib/revalidate";
import { generateProjectImageAlt } from "@/lib/image-alt";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    assertUploadRequestSize(request, MAX_IMAGE_UPLOAD_SIZE, "Image file size must be 200MB or less.");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "File and projectId are required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { categories: { include: { category: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const imageAsset = await uploadImage(file);

    let image;
    try {
      const maxOrder = await prisma.projectImage.aggregate({
        where: { projectId },
        _max: { sortOrder: true },
      });

      const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
      image = await prisma.projectImage.create({
        data: {
          projectId,
          url: imageAsset.webUrl,
          originalUrl: imageAsset.originalUrl,
          webUrl: imageAsset.webUrl,
          thumbnailUrl: imageAsset.thumbnailUrl,
          fileSize: imageAsset.fileSize,
          width: imageAsset.width,
          height: imageAsset.height,
          mimeType: imageAsset.mimeType,
          alt: generateProjectImageAlt({
            title: project.title,
            titleTr: project.titleTr,
            titleEn: project.titleEn,
            categories: project.categories.map(({ category }) => category),
            order: sortOrder + 1,
            existingAlt: file.name,
          }),
          sortOrder,
        },
      });
    } catch (error) {
      await Promise.allSettled(
        [imageAsset.originalUrl, imageAsset.webUrl, imageAsset.thumbnailUrl].map(deleteStoredFile),
      ).then((results) => {
        if (results.some((result) => result.status === "rejected")) {
          console.error("[project-image:upload] failed to clean up one or more orphaned R2 objects");
        }
      });
      throw error;
    }

    revalidateStudioContent([`/projects/${project.slug}`, `/admin/projects/${project.id}/edit`]);

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
