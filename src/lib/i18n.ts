export type Language = "tr" | "en";

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_COOKIE = "site-language";

export const BRAND_NAME = "Mehmet Eser Interior Design Studio";

export const translations = {
  tr: {
    nav: {
      home: "Ana Sayfa",
      projects: "Projeler",
      about: "Biz Kimiz",
      contact: "İletişim",
      navigation: "Navigasyon",
    },
    common: {
      all: "Tümü",
      backToProjects: "Projelere Dön",
      viewProject: "Projeyi İncele",
      viewProjects: "Projeleri İncele",
      downloadPdf: "PDF Sunumu İndir",
      noProjects: "Bu kategoride henüz proje yok.",
      noPublishedProjects: "Henüz yayında proje yok.",
    },
    home: {
      eyebrow: "Luxury Interior Architecture",
      subtitle:
        "Işık, malzeme ve oran odağında; çağdaş iç mimarlık projeleri için sakin, rafine ve zamansız görsel anlatımlar üretiyoruz.",
    },
    projects: {
      eyebrow: "Portfolyo",
      title: "Projeler",
      intro:
        "İdari yapılar, lüks villalar ve cephe tasarımlarından oluşan seçilmiş bir portfolyo.",
    },
    about: {
      eyebrow: "Stüdyo",
      title: "Zamansız Bir Görsel Denge",
      body:
        "2020 yılında kurulan Mehmet Eser Interior Design Studio, Gaziantep merkezli bir iç mimarlık stüdyosudur. Malzeme dengesi, oran, detay kalitesi ve zamansız görsel anlatım odağında iç mekan tasarımları, mimari render sunumları ve konsept projeler üretir.",
      method: "Yaklaşım",
      methodTitle: "Tasarım yaklaşımı",
      cards: [
        {
          title: "Malzeme",
          text: "Her projede dokuların, renklerin ve yüzeylerin dengeli bir bütün oluşturmasına odaklanırız.",
        },
        {
          title: "Oran",
          text: "Mekan kurgusunu insan ölçeği, akış ve görsel sakinlik üzerinden rafine ederiz.",
        },
        {
          title: "Anlatım",
          text: "Render sunumları ve konsept görsellerle tasarım fikrini net, güçlü ve zamansız biçimde aktarırız.",
        },
      ],
    },
    contact: {
      eyebrow: "İletişim",
      title: "Birlikte Özel Bir Mekan Tasarlayalım",
      business: "İşletme",
      city: "Şehir",
      phone: "Telefon",
      instagram: "Instagram",
      address: "Adres",
      openMaps: "Google Maps'te Aç",
      formTitle: "Mesaj Gönder",
      name: "Ad Soyad",
      email: "E-posta",
      message: "Mesaj",
      send: "Mesaj Gönder",
    },
    footer: {
      description:
        "Gaziantep merkezli iç mimarlık stüdyosu; malzeme, oran ve sakin detaylarla rafine mekanlar tasarlar.",
      rightsReserved: "Tüm hakları saklıdır.",
    },
  },
  en: {
    nav: {
      home: "Home",
      projects: "Projects",
      about: "About",
      contact: "Contact",
      navigation: "Navigation",
    },
    common: {
      all: "All",
      backToProjects: "Back To Projects",
      viewProject: "View Project",
      viewProjects: "View Projects",
      downloadPdf: "Download PDF Presentation",
      noProjects: "No projects in this category yet.",
      noPublishedProjects: "No published projects yet.",
    },
    home: {
      eyebrow: "Luxury Interior Architecture",
      subtitle:
        "A quiet study of light, material, and proportion across a contemporary interior architecture portfolio.",
    },
    projects: {
      eyebrow: "Portfolio",
      title: "Projects",
      intro:
        "A curated portfolio of administrative buildings, luxury villas, and facade design projects.",
    },
    about: {
      eyebrow: "Our Studio",
      title: "Design With Enduring Presence",
      body:
        "Founded in 2020, Mehmet Eser Interior Design Studio is an interior architecture studio based in Gaziantep, creating refined interiors, architectural render presentations, and design concepts with a focus on material clarity, proportion, and timeless visual quality.",
      method: "Method",
      methodTitle: "Our approach",
      cards: [
        {
          title: "Material",
          text: "We focus on balanced textures, color, and surfaces that form a calm architectural whole.",
        },
        {
          title: "Proportion",
          text: "Spatial decisions are refined through human scale, flow, and visual restraint.",
        },
        {
          title: "Presentation",
          text: "Render presentations and concept visuals communicate each design idea with clarity and permanence.",
        },
      ],
    },
    contact: {
      eyebrow: "Contact",
      title: "Let's Create Something Extraordinary",
      business: "Business",
      city: "City",
      phone: "Phone",
      instagram: "Instagram",
      address: "Address",
      openMaps: "Open In Google Maps",
      formTitle: "Send a Message",
      name: "Name",
      email: "Email",
      message: "Message",
      send: "Send Message",
    },
    footer: {
      description:
        "Interior architecture studio in Gaziantep, shaping refined spaces through material, proportion, and quiet detail.",
      rightsReserved: "All rights reserved.",
    },
  },
} as const;

export const categoryTranslations: Record<string, Record<Language, string>> = {
  "Lüks Villa": {
    tr: "Lüks Villa",
    en: "Luxury Villa",
  },
  "İdari Bina": {
    tr: "İdari Bina",
    en: "Administrative Building",
  },
  "Cephe Tasarımı": {
    tr: "Cephe Tasarımı",
    en: "Facade Design",
  },
  "Örnek Daire": {
    tr: "Örnek Daire",
    en: "Sample Apartment",
  },
  Otel: {
    tr: "Otel",
    en: "Hotel",
  },
  Ofis: {
    tr: "Ofis",
    en: "Office",
  },
  "Restoran / Cafe": {
    tr: "Restoran / Cafe",
    en: "Restaurant / Cafe",
  },
  Konut: {
    tr: "Konut",
    en: "Residential",
  },
  "Ticari Alan": {
    tr: "Ticari Alan",
    en: "Commercial Space",
  },
  "İç Mekan": {
    tr: "İç Mekan",
    en: "Interior",
  },
  "Dış Mekan": {
    tr: "Dış Mekan",
    en: "Exterior",
  },
  Peyzaj: {
    tr: "Peyzaj",
    en: "Landscape",
  },
  Diğer: {
    tr: "Diğer",
    en: "Other",
  },
};

type ProjectText = {
  title: string;
  titleTr?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionTr?: string | null;
  descriptionEn?: string | null;
};

export function normalizeLanguage(value?: string | null): Language {
  return value === "tr" ? "tr" : DEFAULT_LANGUAGE;
}

export function toLanguageUppercase(value: string, language: Language) {
  return value.toLocaleUpperCase(language === "tr" ? "tr-TR" : "en-US");
}

export function getProjectTitle(project: ProjectText, language: Language) {
  return language === "en"
    ? project.titleEn || project.title || project.titleTr || ""
    : project.titleTr || project.title || project.titleEn || "";
}

export function getProjectDescription(project: ProjectText, language: Language) {
  return language === "en"
    ? project.descriptionEn || project.description || project.descriptionTr || null
    : project.descriptionTr || project.description || project.descriptionEn || null;
}

// Category records stay canonical in Turkish for stable filtering and admin data.
// Public labels are mapped here so more languages can be added without reshaping project data.
export function translateCategoryName(name: string, language: Language) {
  return categoryTranslations[name]?.[language] ?? name;
}

type CategoryText = {
  name: string;
  nameTr?: string | null;
  nameEn?: string | null;
};

export function getCategoryLabel(category: CategoryText, language: Language) {
  if (language === "en") {
    return category.nameEn || translateCategoryName(category.name, "en");
  }

  return category.nameTr || translateCategoryName(category.name, "tr");
}
