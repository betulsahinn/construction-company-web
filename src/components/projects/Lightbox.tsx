"use client";

import { useEffect, useCallback } from "react";
import { SmartImage } from "@/components/SmartImage";
import { motion, AnimatePresence } from "framer-motion";
type LightboxImage = {
  id: string;
  url: string;
  webUrl?: string | null;
  thumbnailUrl?: string | null;
  originalUrl?: string | null;
  alt: string | null;
};

type LightboxProps = {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
};

export function Lightbox({ images, currentIndex, onClose, onNext, onPrev }: LightboxProps) {
  const current = images[currentIndex];
  const currentUrl = current.webUrl ?? current.originalUrl ?? current.url;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    },
    [onClose, onNext, onPrev],
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/96"
        onClick={onClose}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-10 flex h-12 w-12 items-center justify-center border border-cream/20 text-cream/80 transition-colors hover:border-accent-light hover:text-cream"
          aria-label="Close lightbox"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 p-2 text-cream/60 transition-colors hover:text-cream md:left-8"
          aria-label="Previous image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 p-2 text-cream/60 transition-colors hover:text-cream md:right-8"
          aria-label="Next image"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="relative mx-14 flex max-h-[90vh] max-w-[90vw] flex-col items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <SmartImage
            src={currentUrl}
            sources={[current.originalUrl, current.url, current.thumbnailUrl]}
            alt={current.alt ?? "Project image"}
            width={1600}
            height={1200}
            className="max-h-[84vh] w-auto object-contain shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
            priority
          />
          <p className="mt-5 text-xs uppercase tracking-[0.22em] text-cream/55">
            {currentIndex + 1} / {images.length}
            {current.alt && <span className="ml-4 text-cream/40">{current.alt}</span>}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
