export const DEFAULT_CATEGORIES = [
  { name: "Lüks Villa", nameTr: "Lüks Villa", nameEn: "Luxury Villa", slug: "luks-villa" },
  { name: "İdari Bina", nameTr: "İdari Bina", nameEn: "Administrative Building", slug: "idari-bina" },
  { name: "Cephe Tasarımı", nameTr: "Cephe Tasarımı", nameEn: "Facade Design", slug: "cephe-tasarimi" },
  { name: "Örnek Daire", nameTr: "Örnek Daire", nameEn: "Sample Apartment", slug: "ornek-daire" },
  { name: "Otel", nameTr: "Otel", nameEn: "Hotel", slug: "otel" },
  { name: "Ofis", nameTr: "Ofis", nameEn: "Office", slug: "ofis" },
  { name: "Restoran / Cafe", nameTr: "Restoran / Cafe", nameEn: "Restaurant / Cafe", slug: "restoran-cafe" },
  { name: "Diğer", nameTr: "Diğer", nameEn: "Other", slug: "diger" },
] as const;

export const DEFAULT_CATEGORY_NAMES = DEFAULT_CATEGORIES.map((category) => category.name);
export const DEPRECATED_DEFAULT_CATEGORY_NAMES = [
  "Konut",
  "Ticari Alan",
  "İç Mekan",
  "Dış Mekan",
  "Peyzaj",
] as const;
