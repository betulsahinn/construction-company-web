"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  ImgHTMLAttributes,
  SyntheticEvent,
} from "react";
import { normalizeMediaUrl } from "@/lib/media-url";

const RETRY_DELAYS = [800, 2000] as const;

type NativeImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onLoad" | "onError"
>;

export type SmartImageProps = NativeImageProps & {
  src: string;
  sources?: Array<string | null | undefined>;
  retryDelays?: readonly number[];
  fill?: boolean;
  priority?: boolean;
  fallbackLabel?: string;
  fallbackClassName?: string;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onFinalError?: () => void;
};

function retryUrl(src: string, retry: number): string {
  try {
    const url = new URL(src, window.location.origin);
    url.searchParams.set("media_retry", String(retry));
    return src.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch {
    return src;
  }
}

/**
 * A browser-native image with a bounded fallback plan. It deliberately never
 * uses the Next.js image optimizer, so R2 objects cannot become /_next/image
 * requests in production.
 */
export function SmartImage({
  src,
  sources = [],
  retryDelays = RETRY_DELAYS,
  fill = false,
  priority = false,
  fallbackLabel,
  fallbackClassName = "bg-stone/25",
  onLoad,
  onError,
  onFinalError,
  className = "",
  style,
  loading,
  decoding = "async",
  fetchPriority,
  width,
  height,
  alt = "",
  ...props
}: SmartImageProps) {
  const sourceKey = [src, ...sources].join("\u001f");
  const candidates = useMemo(() => {
    const normalized = [src, ...sources]
      .map(normalizeMediaUrl)
      .filter((url): url is string => Boolean(url));
    return [...new Set(normalized)].slice(0, retryDelays.length + 1);
    // sourceKey captures the string values without making callers memoize arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, retryDelays]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setCandidateIndex(0);
    setRetryCount(0);
    setState("loading");
    if (retryTimer.current) clearTimeout(retryTimer.current);
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [sourceKey]);

  const baseUrl = candidates[candidateIndex] ?? "";
  const effectiveUrl =
    retryCount > 0 && candidateIndex === 0 && candidates.length === 1
      ? retryUrl(baseUrl, retryCount)
      : baseUrl;

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setState("loaded");
  }, [effectiveUrl]);

  const fillStyle: CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style }
    : style;

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    setState("loaded");
    onLoad?.(event);
  }

  function handleError(event: SyntheticEvent<HTMLImageElement>) {
    onError?.(event);
    if (retryTimer.current) return;

    if (retryCount >= retryDelays.length) {
      setState("failed");
      onFinalError?.();
      return;
    }

    setState("loading");
    const nextRetry = retryCount + 1;
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      setRetryCount(nextRetry);
      setCandidateIndex((current) =>
        current + 1 < candidates.length ? current + 1 : current,
      );
    }, retryDelays[retryCount]);
  }

  if (!effectiveUrl || state === "failed") {
    return (
      <div
        role={fallbackLabel ? "img" : undefined}
        aria-label={fallbackLabel ? alt : undefined}
        aria-hidden={fallbackLabel ? undefined : true}
        className={`flex items-center justify-center ${fallbackClassName} ${className}`}
        style={{
          ...fillStyle,
          ...(!fill && width && height ? { aspectRatio: `${width} / ${height}` } : {}),
        }}
      >
        {fallbackLabel ? <span className="px-4 text-center text-xs text-warm-gray">{fallbackLabel}</span> : null}
      </div>
    );
  }

  return (
    // Public and admin media use the same direct R2 URL path.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      ref={imageRef}
      key={`${effectiveUrl}-${retryCount}`}
      src={effectiveUrl}
      alt={alt}
      className={`${className} transition-opacity duration-300 ${
        state === "loaded" ? "opacity-100" : "animate-pulse bg-stone/25 opacity-70"
      }`}
      loading={loading ?? (priority ? "eager" : "lazy")}
      fetchPriority={fetchPriority ?? (priority ? "high" : "auto")}
      decoding={decoding}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={{ ...fillStyle, color: "transparent", fontSize: 0 }}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
