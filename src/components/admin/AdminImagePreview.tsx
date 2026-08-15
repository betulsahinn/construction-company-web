"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const RETRY_DELAYS = [500, 1500, 3000] as const;

type AdminImagePreviewProps = {
  image: {
    id: string;
    thumbnailUrl: string | null;
    webUrl: string | null;
    url: string;
    originalUrl: string | null;
  };
  alt: string;
};

type PreviewState = "loading" | "loaded" | "failed";

function addRetryQuery(src: string, attempt: number) {
  try {
    const url = new URL(src, window.location.origin);
    url.searchParams.set("retry", String(attempt));
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}retry=${attempt}`;
  }
}

export function AdminImagePreview({ image, alt }: AdminImagePreviewProps) {
  const sources = useMemo(
    () =>
      Array.from(
        new Set(
          [image.thumbnailUrl, image.webUrl, image.url, image.originalUrl].filter(
            (source): source is string => Boolean(source),
          ),
        ),
      ),
    [image.originalUrl, image.thumbnailUrl, image.url, image.webUrl],
  );
  const sourceKey = sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PreviewState>("loading");
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const source = sources[sourceIndex];

  useEffect(() => {
    setSourceIndex(0);
    setAttempt(0);
    setState("loading");
    if (retryTimer.current) clearTimeout(retryTimer.current);

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [image.id, sourceKey]);

  useEffect(() => {
    const element = imageRef.current;
    if (element?.complete && element.naturalWidth > 0) setState("loaded");
  }, [attempt, sourceIndex, source]);

  function handleError() {
    if (retryTimer.current) clearTimeout(retryTimer.current);

    // The first available source is normally the just-created thumbnail. Give
    // R2 time to make it readable before falling through to larger variants.
    if (sourceIndex === 0 && attempt < RETRY_DELAYS.length) {
      setState("loading");
      retryTimer.current = setTimeout(() => {
        setAttempt((current) => current + 1);
      }, RETRY_DELAYS[attempt]);
      return;
    }

    if (sourceIndex < sources.length - 1) {
      setSourceIndex((current) => current + 1);
      setAttempt(0);
      setState("loading");
      return;
    }

    setState("failed");
  }

  if (!source || state === "failed") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-stone/25 text-xs text-warm-gray">
        Preview unavailable
      </div>
    );
  }

  const renderedSource = attempt === 0 ? source : addRetryQuery(source, attempt);

  return (
    <div className="absolute inset-0 overflow-hidden bg-stone/20">
      {state !== "loaded" && <div className="absolute inset-0 animate-pulse bg-stone/35" aria-hidden="true" />}
      {/* Admin previews intentionally bypass the Next.js optimizer for R2 objects. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        key={`${source}-${attempt}`}
        src={renderedSource}
        alt={alt}
        className={`h-full w-full object-cover transition-opacity duration-150 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
        style={{ color: "transparent", fontSize: 0 }}
        loading="eager"
        decoding="async"
        onLoad={() => setState("loaded")}
        onError={handleError}
      />
    </div>
  );
}
