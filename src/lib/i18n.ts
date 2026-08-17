export type Language = "tr" | "en";

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_COOKIE = "site-language";

export const BRAND_NAME = "Turkuvaz İnşaat";

export const translations = {
  tr: {
    nav: {
      home: "Ana Sayfa",
      projects: "Projeler",
      about: "Hakkımızda",
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
      eyebrow: "Turkuvaz İnşaat",
      subtitle:
        "Yapı projelerinde planlı, dikkatli ve güvenilir uygulama süreçlerine odaklanan profesyonel inşaat yaklaşımı.",
    },
    projects: {
      eyebrow: "Projeler",
      title: "Projeler",
      intro:
        "Turkuvaz İnşaat tarafından yürütülen ve yayına alınan proje kayıtlarını inceleyin.",
    },
    about: {
      eyebrow: "Hakkımızda",
      title: "Güvenilir İnşaat Yaklaşımı",
      body:
        "Turkuvaz İnşaat, Gaziantep merkezli yapı projelerinde kaliteli uygulama, düzenli süreç yönetimi ve müşteri odaklı iletişime önem veren bir inşaat firmasıdır.",
      method: "Yaklaşım",
      methodTitle: "Çalışma yaklaşımı",
      cards: [
        {
          title: "Kalite",
          text: "Projelerde malzeme, uygulama ve detay kararlarının özenli biçimde ele alınmasına odaklanırız.",
        },
        {
          title: "Güven",
          text: "Süreç boyunca açık iletişim, düzenli takip ve sorumlu proje yürütme anlayışını önemseriz.",
        },
        {
          title: "Uygulama",
          text: "Modern yapı pratikleriyle uyumlu, planlı ve dikkatli uygulama süreçleri geliştirmeyi hedefleriz.",
        },
      ],
    },
    contact: {
      eyebrow: "İletişim",
      title: "Projeniz İçin İletişime Geçin",
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
        "Gaziantep merkezli inşaat firması; yapı projelerinde planlı uygulama ve güvenilir süreç yönetimine odaklanır.",
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
      eyebrow: "Turkuvaz İnşaat",
      subtitle:
        "A professional construction approach focused on planned, careful, and reliable project execution.",
    },
    projects: {
      eyebrow: "Projects",
      title: "Projects",
      intro:
        "Explore published project records managed by Turkuvaz İnşaat.",
    },
    about: {
      eyebrow: "About",
      title: "A Reliable Construction Approach",
      body:
        "Turkuvaz İnşaat is a Gaziantep-based construction company focused on quality execution, organized project processes, and customer-oriented communication.",
      method: "Approach",
      methodTitle: "Our approach",
      cards: [
        {
          title: "Quality",
          text: "We focus on careful handling of material, execution, and detail decisions throughout each project.",
        },
        {
          title: "Reliability",
          text: "We value clear communication, consistent follow-up, and responsible project coordination.",
        },
        {
          title: "Execution",
          text: "We aim to support planned and attentive construction processes aligned with modern building practices.",
        },
      ],
    },
    contact: {
      eyebrow: "Contact",
      title: "Contact Us About Your Project",
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
        "Gaziantep-based construction company focused on planned execution and reliable project processes.",
      rightsReserved: "All rights reserved.",
    },
  },
} as const;

export const categoryTranslations: Record<string, Record<Language, string>> = {
  Residential: {
    tr: "Residential",
    en: "Residential",
  },
  Commercial: {
    tr: "Commercial",
    en: "Commercial",
  },
  Cooperative: {
    tr: "Cooperative",
    en: "Cooperative",
  },
  Other: {
    tr: "Other",
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
