import type { Language } from "@/lib/i18n";

type AltCategory = {
  name: string;
  nameTr?: string | null;
  nameEn?: string | null;
};

export type ImageAltInput = {
  title: string;
  titleTr?: string | null;
  titleEn?: string | null;
  categories?: AltCategory[];
  order: number;
  existingAlt?: string | null;
  language?: Language;
  force?: boolean;
};

const technicalTerms = /(?:light\s*mix|\bcopy\b|\bfinal\b|\brender\b|\bimg[_-]?\d*|\bdsc[_-]?\d*)/i;
const fileExtension = /\.(?:jpe?g|png|webp|avif|gif|tiff?)$/i;
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const filenameShape = /^(?:\d+[_-]|[a-z]{2,5}[_-]?\d{3,}|.*[_-](?:v?\d+|post|edit))/i;
const numericOrFilenameLabel = /^(?:\d+|[a-z0-9]+(?:[ _-][a-z0-9]+)*\d+)$/i;

export function looksLikeTechnicalImageAlt(value?: string | null): boolean {
  if (!value?.trim()) return true;
  const normalized = value.trim();
  return technicalTerms.test(normalized) || fileExtension.test(normalized) || uuid.test(normalized) || filenameShape.test(normalized) || numericOrFilenameLabel.test(normalized);
}

export function generateProjectImageAlt(input: ImageAltInput): string {
  const language = input.language ?? "en";
  const existing = input.existingAlt?.trim();
  if (!input.force && existing && !looksLikeTechnicalImageAlt(existing)) return existing;

  const title = (language === "tr" ? input.titleTr : input.titleEn) || input.title || input.titleTr || input.titleEn || "Project";
  const categoryLabels = (input.categories ?? [])
    .map((category) => (language === "tr" ? category.nameTr : category.nameEn) || category.name)
    .filter(Boolean)
    .slice(0, 2);
  const categoryText = categoryLabels.join(" ").trim();
  const facade = categoryText.toLocaleLowerCase(language === "tr" ? "tr-TR" : "en-US").includes(language === "tr" ? "cephe" : "facade");

  if (language === "tr") {
    const context = facade
      ? `${categoryText} cephe render görünümü`
      : categoryText
        ? `${categoryText} render görünümü`
        : "iç mekan tasarım render görünümü";
    return `${title} ${context} ${input.order}`.replace(/\s+/g, " ").trim();
  }

  const context = facade
    ? `${categoryText} facade render view`
    : categoryText
      ? `${categoryText} render view`
      : "interior design render view";
  return `${title} ${context} ${input.order}`.replace(/\s+/g, " ").trim();
}
