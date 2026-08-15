import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { assertUploadRequestSize, deleteStoredFile, MAX_IMAGE_UPLOAD_SIZE, uploadImage } from "@/lib/storage";
import { ABOUT_SETTINGS_ID, defaultAboutSettings } from "@/lib/site-settings";
import { revalidateStudioContent } from "@/lib/revalidate";

export async function POST(request: Request) {
  try {
    await requireAuth();
    assertUploadRequestSize(request, MAX_IMAGE_UPLOAD_SIZE, "Image file size must be 200MB or less.");
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const existing = await prisma.aboutPage.findUnique({ where: { id: ABOUT_SETTINGS_ID } });
    const imageAsset = await uploadImage(file);

    await deleteAboutImageFiles(existing);

    const settings = await prisma.aboutPage.upsert({
      where: { id: ABOUT_SETTINGS_ID },
      update: {
        imageUrl: imageAsset.webUrl,
        imageOriginalUrl: imageAsset.originalUrl,
        imageWebUrl: imageAsset.webUrl,
        imageThumbnailUrl: imageAsset.thumbnailUrl,
        imageFileSize: imageAsset.fileSize,
        imageWidth: imageAsset.width,
        imageHeight: imageAsset.height,
        imageMimeType: imageAsset.mimeType,
      },
      create: {
        id: ABOUT_SETTINGS_ID,
        imageUrl: imageAsset.webUrl,
        imageOriginalUrl: imageAsset.originalUrl,
        imageWebUrl: imageAsset.webUrl,
        imageThumbnailUrl: imageAsset.thumbnailUrl,
        imageFileSize: imageAsset.fileSize,
        imageWidth: imageAsset.width,
        imageHeight: imageAsset.height,
        imageMimeType: imageAsset.mimeType,
      },
    });

    revalidateStudioContent();

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "About image upload failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAuth();
    const existing = await prisma.aboutPage.findUnique({ where: { id: ABOUT_SETTINGS_ID } });

    await deleteAboutImageFiles(existing);

    const settings = await prisma.aboutPage.upsert({
      where: { id: ABOUT_SETTINGS_ID },
      update: {
        imageUrl: null,
        imageOriginalUrl: null,
        imageWebUrl: null,
        imageThumbnailUrl: null,
        imageFileSize: null,
        imageWidth: null,
        imageHeight: null,
        imageMimeType: null,
      },
      create: { id: ABOUT_SETTINGS_ID },
    });

    revalidateStudioContent();

    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "About image delete failed" }, { status: 500 });
  }
}

async function deleteAboutImageFiles(about: Awaited<ReturnType<typeof prisma.aboutPage.findUnique>>) {
  if (!about) return;

  const urls = new Set(
    [about.imageUrl, about.imageOriginalUrl, about.imageWebUrl, about.imageThumbnailUrl].filter(
      (url): url is string => Boolean(url),
    ),
  );

  for (const url of urls) {
    if (url === defaultAboutSettings.imageUrl) continue;
    await deleteStoredFile(url);
  }
}
