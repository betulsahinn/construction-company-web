"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import { SmartImage } from "@/components/SmartImage";
import Masonry from "react-masonry-css";
import { motion } from "framer-motion";
import { Lightbox } from "./Lightbox";
import type { Language } from "@/lib/i18n";

type GalleryImage = {
  id: string;
  url: string;
  webUrl?: string | null;
  thumbnailUrl?: string | null;
  originalUrl?: string | null;
  alt: string | null;
};

type MasonryGalleryProps = {
  images: GalleryImage[];
  language: Language;
};

const BATCH_SIZE = 9;

const breakpointColumns = {
  default: 3,
  1024: 2,
  640: 1,
};

export function MasonryGallery({ images, language }: MasonryGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [isLoadingBatch, startBatchTransition] = useTransition();
  const visibleImages = useMemo(() => images.slice(0, visibleCount), [images, visibleCount]);
  const hasMore = visibleCount < images.length;

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex((prev) => (prev !== null ? (prev + 1) % images.length : null));
  }, [images.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null ? (prev - 1 + images.length) % images.length : null,
    );
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-stone bg-[#e8e4df] text-warm-gray">
        No images available
      </div>
    );
  }

  return (
    <>
      <Masonry
        breakpointCols={breakpointColumns}
        className="flex w-auto gap-5 md:gap-8"
        columnClassName="space-y-5 md:space-y-8"
      >
        {visibleImages.map((image, index) => {
          const imageUrl = image.webUrl ?? image.url;
          return (
            <motion.button
              key={image.id}
              type="button"
              initial={{ y: 20 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: (index % BATCH_SIZE) * 0.035 }}
              onClick={() => openLightbox(index)}
              className="group relative w-full overflow-hidden bg-[#e8e4df]"
            >
              <SmartImage
                src={imageUrl}
                sources={[image.thumbnailUrl, image.url]}
                alt={image.alt ?? "Project image"}
                width={800}
                height={600}
                className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
              />
              <div className="pointer-events-none absolute inset-0 bg-charcoal/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </motion.button>
          );
        })}
      </Masonry>

      {hasMore && (
        <div className="mt-12 flex justify-center">
          <button
            type="button"
            disabled={isLoadingBatch}
            onClick={() => startBatchTransition(() => setVisibleCount((count) => Math.min(count + BATCH_SIZE, images.length)))}
            className="border border-charcoal px-8 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-charcoal transition-colors hover:border-accent hover:bg-accent disabled:opacity-50"
          >
            {isLoadingBatch ? (language === "tr" ? "Yükleniyor..." : "Loading...") : (language === "tr" ? "Daha Fazla Yükle" : "Load More")}
          </button>
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={goNext}
          onPrev={goPrev}
        />
      )}
    </>
  );
}
