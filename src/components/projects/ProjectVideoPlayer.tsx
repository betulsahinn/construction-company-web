"use client";

import { useEffect, useRef } from "react";

type ProjectVideoPlayerProps = {
  src: string;
  className?: string;
};

export function ProjectVideoPlayer({ src, className }: ProjectVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const videoElement = video;
    let cancelled = false;

    async function attemptAutoplay() {
      videoElement.muted = false;

      try {
        await videoElement.play();
        return;
      } catch {
        if (cancelled) return;
      }

      videoElement.muted = true;

      try {
        await videoElement.play();
      } catch {
        // Browser policy may still require an explicit user gesture; controls remain available.
      }
    }

    void attemptAutoplay();

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      className={className}
      controls
      playsInline
      preload="metadata"
    />
  );
}
