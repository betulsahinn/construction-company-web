"use client";

import { useEffect, useState } from "react";
import { SmartImage } from "@/components/SmartImage";
import { normalizeMediaUrl } from "@/lib/media-url";

const HERO_VIDEO_READY_KEY = "heroVideoReady";

function wasVideoReadyInSession(videoUrl: string): boolean {
  try {
    return window.sessionStorage.getItem(HERO_VIDEO_READY_KEY) === videoUrl;
  } catch {
    return false;
  }
}

function rememberReadyVideo(videoUrl: string) {
  try {
    window.sessionStorage.setItem(HERO_VIDEO_READY_KEY, videoUrl);
  } catch {
    // Storage can be unavailable in restrictive/private browser modes.
  }
}

type HeroMediaProps = {
  mediaType: "image" | "video";
  imageUrl: string | null;
  imageSources?: Array<string | null | undefined>;
  videoUrl: string | null;
};

export function HeroMedia({
  mediaType,
  imageUrl,
  imageSources = [],
  videoUrl,
}: HeroMediaProps) {
  const safeVideoUrl = normalizeMediaUrl(videoUrl);
  const safePosterUrl = normalizeMediaUrl(imageUrl);
  const wantsVideo = Boolean(
    safeVideoUrl && (mediaType === "video" || !imageUrl),
  );
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [sessionVideoReady, setSessionVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoTimedOut, setVideoTimedOut] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    setPosterLoaded(false);
    setPosterFailed(false);
    setVideoReady(false);
    setSessionVideoReady(
      Boolean(safeVideoUrl && wasVideoReadyInSession(safeVideoUrl)),
    );
    setVideoFailed(false);
    setVideoTimedOut(false);
  }, [imageUrl, mediaType, safeVideoUrl]);

  const shouldLoadVideo = Boolean(
    wantsVideo &&
      !videoFailed &&
      isMobile !== null &&
      (isMobile === false || sessionVideoReady || posterLoaded || posterFailed || !imageUrl),
  );

  const showVideo = Boolean(
    !videoTimedOut &&
      (videoReady || (isMobile === true && sessionVideoReady)),
  );

  useEffect(() => {
    if (!shouldLoadVideo || !isMobile || videoReady) return;
    const timer = window.setTimeout(() => setVideoTimedOut(true), 3000);
    return () => window.clearTimeout(timer);
  }, [isMobile, shouldLoadVideo, videoReady]);

  return (
    <>
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(163,137,104,0.22),transparent_45%),linear-gradient(145deg,#2b2926,#151412)]"
        aria-hidden="true"
      />

      {imageUrl ? (
        <SmartImage
          src={imageUrl}
          sources={imageSources}
          alt="Homepage hero"
          fill
          priority
          className="object-cover"
          fallbackClassName="bg-transparent"
          sizes="100vw"
          onLoad={() => setPosterLoaded(true)}
          onFinalError={() => setPosterFailed(true)}
        />
      ) : null}

      {shouldLoadVideo && safeVideoUrl ? (
        <video
          key={safeVideoUrl}
          src={safeVideoUrl}
          poster={safePosterUrl ?? undefined}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            showVideo ? "opacity-100" : "opacity-0"
          }`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onCanPlay={() => {
            if (!videoTimedOut) {
              setVideoReady(true);
              setSessionVideoReady(true);
              rememberReadyVideo(safeVideoUrl);
            }
          }}
          onError={() => setVideoFailed(true)}
        />
      ) : null}
    </>
  );
}
