type DescriptionTemplate = {
  trUse: string;
  enUse: string;
  trType: string;
  enType: string;
  trFocus: string;
  enFocus: string;
};

type GenerateDescriptionInput = {
  titleTr: string;
  titleEn: string;
  fallbackTitle: string;
  location: string;
  year: string;
  categories: string[];
};

const templates: Record<string, DescriptionTemplate> = {
  Residential: {
    trUse: "konut ihtiyaçlarına yönelik ele alınan",
    enUse: "developed around residential construction needs",
    trType: "konut inşaat projesi",
    enType: "residential construction project",
    trFocus: "planlı uygulama, detay takibi ve güvenilir süreç yönetimiyle",
    enFocus: "planned execution, detail tracking, and reliable process management",
  },
  Commercial: {
    trUse: "ticari kullanım ihtiyaçları doğrultusunda ele alınan",
    enUse: "developed around commercial construction needs",
    trType: "ticari inşaat projesi",
    enType: "commercial construction project",
    trFocus: "işlevsel planlama, uygulama disiplini ve dikkatli koordinasyonuyla",
    enFocus: "functional planning, disciplined execution, and attentive coordination",
  },
  Cooperative: {
    trUse: "kooperatif yapı süreçlerine yönelik ele alınan",
    enUse: "developed around cooperative construction processes",
    trType: "kooperatif inşaat projesi",
    enType: "cooperative construction project",
    trFocus: "düzenli süreç takibi, iletişim ve dikkatli uygulama yaklaşımıyla",
    enFocus: "organized process tracking, communication, and careful execution",
  },
  Other: {
    trUse: "projenin ihtiyaçlarına özel geliştirilen",
    enUse: "developed around the specific needs of the project",
    trType: "inşaat projesi",
    enType: "construction project",
    trFocus: "planlı uygulama, güvenilir iletişim ve dikkatli süreç yönetimiyle",
    enFocus: "planned execution, reliable communication, and attentive process management",
  },
};

export function generateProjectDescriptions(input: GenerateDescriptionInput) {
  const selectedTemplates = getSelectedTemplates(input.categories);
  const primaryTemplate = selectedTemplates[0];
  const titleTr = input.titleTr || input.fallbackTitle || input.titleEn || "Bu proje";
  const titleEn = input.titleEn || input.fallbackTitle || input.titleTr || "This project";
  const trContext = formatContext(input.location, input.year, "tr");
  const enContext = formatContext(input.location, input.year, "en");

  return {
    tr: `${titleTr}, ${trContext}${joinUnique(selectedTemplates.map((template) => template.trUse), "tr")}; ${joinUnique(
      selectedTemplates.map((template) => template.trFocus),
      "tr",
      "focus",
    )} öne çıkan bir ${primaryTemplate.trType}dır.`,
    en: `${titleEn} is ${enContext}${joinUnique(selectedTemplates.map((template) => template.enUse), "en")}; a refined ${primaryTemplate.enType} distinguished by ${joinUnique(
      selectedTemplates.map((template) => template.enFocus),
      "en",
      "focus",
    )}.`,
  };
}

function getSelectedTemplates(categories: string[]) {
  const selected = categories.map((category) => templates[category]).filter(Boolean);
  return selected.length ? selected : [templates.Other];
}

function formatContext(location: string, year: string, language: "tr" | "en") {
  if (language === "tr") {
    const locationText = location ? `${location}'te ` : "";
    const yearText = year ? `${year} yılında ` : "";
    return `${locationText}${yearText}`;
  }

  if (location && year) return `a ${year} project in ${location} `;
  if (location) return `a project in ${location} `;
  if (year) return `a ${year} project `;
  return "";
}

function joinUnique(items: string[], language: "tr" | "en", mode: "phrase" | "focus" = "phrase") {
  const uniqueItems = Array.from(new Set(items));

  if (uniqueItems.length <= 1) return uniqueItems[0] ?? "";
  if (mode === "focus") return uniqueItems.join(", ");
  if (uniqueItems.length === 2) return `${uniqueItems[0]} ${language === "tr" ? "ve" : "and"} ${uniqueItems[1]}`;

  return `${uniqueItems.slice(0, -1).join(", ")} ${language === "tr" ? "ve" : "and"} ${uniqueItems[uniqueItems.length - 1]}`;
}
