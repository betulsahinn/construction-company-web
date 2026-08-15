"use client";

import { SmartImage } from "@/components/SmartImage";
import Link from "next/link";
import { motion } from "framer-motion";
import { toLanguageUppercase, type Language } from "@/lib/i18n";

type HeroContentProps = {
  title?: string;
  logoSrc?: string;
  logoAlt?: string;
  eyebrow?: string;
  description?: string;
  href: string;
  ctaLabel?: string;
  language: Language;
};

export function HeroContent({ title, logoSrc, logoAlt, eyebrow, description, href, ctaLabel, language }: HeroContentProps) {
  const titleLines = title?.split("\n") ?? [];
  const displayCtaLabel = ctaLabel ? toLanguageUppercase(ctaLabel, language) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className="absolute inset-x-0 top-[78%] mx-auto w-full max-w-[1120px] px-6 text-center min-[420px]:top-[80%] md:top-[84%]"
    >
      {eyebrow && (
        <p className="mx-auto max-w-[calc(100vw-2rem)] text-[0.78rem] font-bold uppercase tracking-[0.42em] text-accent-light drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:text-[0.86rem] sm:tracking-[0.48em] md:text-[0.95rem]">
          {eyebrow}
        </p>
      )}
      {logoSrc ? (
        <div className="mx-auto mt-10 flex justify-center drop-shadow-[0_12px_38px_rgba(0,0,0,0.45)]">
          <SmartImage
            src={logoSrc}
            alt={logoAlt ?? "Mehmet Eser logo"}
            width={520}
            height={260}
            priority
            className="h-auto w-[min(72vw,460px)] object-contain md:w-[min(52vw,560px)]"
          />
        </div>
      ) : title && (
        <h1 className="mx-auto mt-11 max-w-[1120px] font-display text-[4.1rem] leading-[0.9] tracking-[0.01em] text-cream md:text-[5.4rem] lg:text-[6.5rem] xl:text-[7rem]">
          {titleLines.map((line) => (
            <span key={line} className="block md:whitespace-nowrap">
              {line}
            </span>
          ))}
        </h1>
      )}
      {description && (
        <p className="mx-auto mt-11 max-w-[620px] text-lg leading-8 text-cream/78">
          {description}
        </p>
      )}
      {displayCtaLabel && (
        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href={href}
            className="min-w-[190px] bg-accent px-8 py-5 text-center text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-charcoal transition-colors hover:bg-cream"
          >
            {displayCtaLabel}
          </Link>
        </div>
      )}
    </motion.div>
  );
}
