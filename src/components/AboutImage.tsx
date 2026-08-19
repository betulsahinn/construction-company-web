"use client";

import { useEffect, useMemo, useState } from "react";
import { SmartImage } from "@/components/SmartImage";

type AboutImageProps = {
  imageWebUrl: string | null;
  imageThumbnailUrl: string | null;
  imageOriginalUrl: string | null;
  imageUrl: string | null;
  alt: string;
};

const ABOUT_IMAGE_RETRY_DELAYS = [800, 2000, 3200] as const;

export function AboutImage({
  imageWebUrl,
  imageThumbnailUrl,
  imageOriginalUrl,
  imageUrl,
  alt,
}: AboutImageProps) {
  const sources = useMemo(
    () => [imageWebUrl, imageThumbnailUrl, imageOriginalUrl, imageUrl].filter((url): url is string => Boolean(url)),
    [imageOriginalUrl, imageThumbnailUrl, imageUrl, imageWebUrl],
  );
  const sourceKey = sources.join("\u001f");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [sourceKey]);

  if (failed || sources.length === 0) return null;

  const [src, ...fallbackSources] = sources;

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-stone">
      <SmartImage
        src={src}
        sources={fallbackSources}
        retryDelays={ABOUT_IMAGE_RETRY_DELAYS}
        alt={alt}
        fill
        className="object-cover"
        fallbackClassName="hidden"
        sizes="(max-width: 1024px) 100vw, 50vw"
        loading="lazy"
        onFinalError={() => setFailed(true)}
      />
    </div>
  );
}
