import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  assertUploadRequestSize,
  deleteStoredFile,
  MAX_IMAGE_UPLOAD_SIZE,
  uploadImage,
  uploadVideo,
} from "@/lib/storage";
import { revalidateStudioContent } from "@/lib/revalidate";

const HERO_ID = "homepage";
const DEFAULT_HERO_IMAGE = "/api/uploads/ai-son.png";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    assertUploadRequestSize(request, MAX_IMAGE_UPLOAD_SIZE, "File size must be 200MB or less.");
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mediaType = formData.get("mediaType");

    if (!file || (mediaType !== "image" && mediaType !== "video")) {
      return NextResponse.json({ error: "File and valid mediaType are required" }, { status: 400 });
    }

    const existing = await prisma.homepageHero.findUnique({ where: { id: HERO_ID } });

    if (mediaType === "image") {
      const imageAsset = await uploadImage(file);
      await deleteHeroImageFiles(existing);

      const hero = await prisma.homepageHero.upsert({
        where: { id: HERO_ID },
        update: {
          imageUrl: imageAsset.webUrl,
          imageOriginalUrl: imageAsset.originalUrl,
          imageWebUrl: imageAsset.webUrl,
          imageThumbnailUrl: imageAsset.thumbnailUrl,
        },
        create: {
          id: HERO_ID,
          mediaType: "image",
          imageUrl: imageAsset.webUrl,
          imageOriginalUrl: imageAsset.originalUrl,
          imageWebUrl: imageAsset.webUrl,
          imageThumbnailUrl: imageAsset.thumbnailUrl,
        },
      });

      revalidateStudioContent();

      return NextResponse.json(hero);
    }

    const url = await uploadVideo(file);
    if (existing?.videoUrl) {
      await deleteStoredFile(existing.videoUrl);
    }

    const hero = await prisma.homepageHero.upsert({
      where: { id: HERO_ID },
      update: { videoUrl: url },
      create: {
        id: HERO_ID,
        mediaType: "video",
        videoUrl: url,
      },
    });

    revalidateStudioContent();

    return NextResponse.json(hero);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Hero media upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const mediaType = request.nextUrl.searchParams.get("mediaType");

    if (mediaType !== "image" && mediaType !== "video") {
      return NextResponse.json({ error: "Valid mediaType is required" }, { status: 400 });
    }

    const existing = await prisma.homepageHero.findUnique({ where: { id: HERO_ID } });

    if (mediaType === "image") {
      await deleteHeroImageFiles(existing);
    } else if (existing?.videoUrl) {
      await deleteStoredFile(existing.videoUrl);
    }

    const selectedMediaType = existing?.mediaType === "video" ? "video" : "image";
    const nextMediaType = selectedMediaType !== mediaType
      ? selectedMediaType
      : mediaType === "image" && existing?.videoUrl
        ? "video"
        : "image";

    const hero = await prisma.homepageHero.upsert({
      where: { id: HERO_ID },
      update:
        mediaType === "image"
          ? { imageUrl: null, imageOriginalUrl: null, imageWebUrl: null, imageThumbnailUrl: null, mediaType: nextMediaType }
          : { videoUrl: null, mediaType: nextMediaType },
      create: { id: HERO_ID, mediaType: "image" },
    });

    revalidateStudioContent();

    return NextResponse.json(hero);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Hero media delete failed" }, { status: 500 });
  }
}

async function deleteHeroImageFiles(hero: Awaited<ReturnType<typeof prisma.homepageHero.findUnique>>) {
  if (!hero) return;

  const urls = new Set(
    [hero.imageUrl, hero.imageOriginalUrl, hero.imageWebUrl, hero.imageThumbnailUrl].filter(
      (url): url is string => Boolean(url),
    ),
  );

  for (const url of urls) {
    if (url === DEFAULT_HERO_IMAGE) continue;
    await deleteStoredFile(url);
  }
}
