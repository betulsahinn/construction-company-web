export const DEFAULT_CATEGORIES = [
  { name: "Residential", nameTr: "Residential", nameEn: "Residential", slug: "residential" },
  { name: "Commercial", nameTr: "Commercial", nameEn: "Commercial", slug: "commercial" },
  { name: "Cooperative", nameTr: "Cooperative", nameEn: "Cooperative", slug: "cooperative" },
  { name: "Other", nameTr: "Other", nameEn: "Other", slug: "other" },
] as const;

export const DEFAULT_CATEGORY_NAMES = DEFAULT_CATEGORIES.map((category) => category.name);
export const DEPRECATED_DEFAULT_CATEGORY_NAMES = [
  "Lüks Villa",
  "İdari Bina",
  "Cephe Tasarımı",
  "Örnek Daire",
  "Otel",
  "Ofis",
  "Restoran / Cafe",
  "Diğer",
] as const;
