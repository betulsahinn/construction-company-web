"use client";

import Link from "next/link";
import { SmartImage } from "@/components/SmartImage";
import { motion } from "framer-motion";
import { toLanguageUppercase, type Language } from "@/lib/i18n";
import { generateProjectImageAlt } from "@/lib/image-alt";

type ProjectCardProps = {
  title: string;
  slug: string;
  location?: string | null;
  year?: number | null;
  categories?: string[];
  imageUrl?: string;
  imageSources?: Array<string | null | undefined>;
  featured?: boolean;
  index?: number;
  language: Language;
  onSelect?: (slug: string) => void;
};

export function ProjectCard({
  title,
  slug,
  location,
  year,
  categories = [],
  imageUrl,
  imageSources = [],
  index = 0,
  language,
  onSelect,
}: ProjectCardProps) {
  return (
    <motion.article
      data-project-slug={slug}
      initial={{ y: 18 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: index * 0.06, ease: "easeOut" }}
    >
      <Link href={`/projects/${slug}`} className="group block" onClick={() => onSelect?.(slug)}>
        <div className="relative aspect-[3/4] overflow-hidden bg-[#e8e4df]">
          {imageUrl ? (
            <SmartImage
              src={imageUrl}
              sources={imageSources}
              alt={generateProjectImageAlt({
                title,
                categories: categories.map((name) => ({ name })),
                order: 1,
                language,
                force: true,
              })}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              loading={index === 0 ? "eager" : "lazy"}
              priority={index === 0}
            />
          ) : (
            <div className="h-full bg-stone/25" aria-hidden="true" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-charcoal/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </div>
        <div className="mt-7">
          {categories.length > 0 && (
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.38em] text-accent">
              {categories.map((category) => toLanguageUppercase(category, language)).join(" / ")}
            </p>
          )}
          <h3 className="mt-2 font-display text-[1.65rem] leading-tight tracking-[0.02em] text-charcoal transition-colors group-hover:text-accent">
            {title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-x-2 text-sm leading-6 text-warm-gray">
            {location && <span>{location}</span>}
            {location && year && <span>-</span>}
            {year && <span>{year}</span>}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
