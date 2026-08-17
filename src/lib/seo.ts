import type { Metadata } from "next";
import { BRAND_NAME, type Language } from "@/lib/i18n";

export const SITE_URL = "https://turkuvazinsaat.com";
export const DEFAULT_OG_IMAGE = "/api/uploads/ai-son.png";
export const LOGO_IMAGE = "/uploads/logo1.png";

export const BUSINESS = {
  name: BRAND_NAME,
  category: "Construction company",
  city: "Gaziantep",
  country: "Türkiye",
  telephone: "+90 543 440 40 9",
  instagram: "https://www.instagram.com/turkuvazinsaat/",
  mapsUrl:
    "https://www.google.com/maps/place/Turkuaz+%C4%B0n%C5%9Faat/@37.079272,37.3478044,17z/data=!3m1!4b1!4m6!3m5!1s0x1531e17753425355:0x9a47ff81cec8adc0!8m2!3d37.079272!4d37.3478044!16s%2Fg%2F11hrl38v7m",
} as const;

export const DEFAULT_SEO = {
  title: BRAND_NAME,
  description:
    "Turkuvaz İnşaat is a Gaziantep-based construction company focused on planned project execution, quality, and reliable communication.",
} as const;

export const pageSeo: Record<
  Language,
  Record<"home" | "projects" | "about" | "contact", { title: string; description: string }>
> = {
  tr: {
    home: {
      title: "Gaziantep İnşaat Firması",
      description:
        "Gaziantep merkezli Turkuvaz İnşaat; yapı projelerinde planlı uygulama, kalite ve güvenilir iletişim odağıyla çalışır.",
    },
    projects: {
      title: "Projeler",
      description:
        "Turkuvaz İnşaat tarafından yayına alınan konut, ticari, kooperatif ve diğer inşaat proje kayıtlarını inceleyin.",
    },
    about: {
      title: "Hakkımızda",
      description:
        "Gaziantep merkezli Turkuvaz İnşaat'ın kalite, güvenilirlik ve dikkatli proje uygulamasına dayanan çalışma yaklaşımı.",
    },
    contact: {
      title: "İletişim",
      description:
        "Gaziantep'teki inşaat projeniz veya iş birliği talebiniz için Turkuvaz İnşaat ile iletişime geçin.",
    },
  },
  en: {
    home: {
      title: "Construction Company in Gaziantep",
      description:
        "Turkuvaz İnşaat is a Gaziantep-based construction company focused on planned execution, quality, and reliable communication.",
    },
    projects: {
      title: "Projects",
      description:
        "Explore published residential, commercial, cooperative, and other construction project records by Turkuvaz İnşaat.",
    },
    about: {
      title: "About",
      description:
        "Learn about Turkuvaz İnşaat's Gaziantep-based approach to quality, reliability, and careful project execution.",
    },
    contact: {
      title: "Contact",
      description:
        "Contact Turkuvaz İnşaat for construction projects and collaboration requests in Gaziantep, Türkiye.",
    },
  },
};

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function getOpenGraphLocale(language: Language) {
  return language === "tr" ? "tr_TR" : "en_US";
}

export function createPageMetadata({
  title,
  description,
  path,
  language,
  image = DEFAULT_OG_IMAGE,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  language: Language;
  image?: string;
  type?: "website" | "article";
}): Metadata {
  const canonical = absoluteUrl(path);
  const imageUrl = image.startsWith("http") ? image : absoluteUrl(image);
  const socialTitle = title === BRAND_NAME ? title : `${title} | ${BRAND_NAME}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      siteName: BRAND_NAME,
      locale: getOpenGraphLocale(language),
      type,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${BRAND_NAME} construction company in Gaziantep`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [imageUrl],
    },
  };
}

export function createProjectMetadata({
  title,
  description,
  slug,
  language,
  image,
}: {
  title: string;
  description: string;
  slug: string;
  language: Language;
  image?: string | null;
}): Metadata {
  const projectTitle =
    language === "tr"
      ? `${title} İnşaat Projesi`
      : `${title} Construction Project`;

  return createPageMetadata({
    title: projectTitle,
    description,
    path: `/projects/${slug}`,
    language,
    image: image ?? DEFAULT_OG_IMAGE,
    type: "article",
  });
}

export function createGlobalStructuredData() {
  const url = absoluteUrl("/");
  const logo = absoluteUrl(LOGO_IMAGE);

  return [
    {
      "@context": "https://schema.org",
      "@type": "HomeAndConstructionBusiness",
      "@id": `${url}#localbusiness`,
      name: BUSINESS.name,
      url,
      logo,
      image: absoluteUrl(DEFAULT_OG_IMAGE),
      telephone: BUSINESS.telephone,
      description: DEFAULT_SEO.description,
      address: {
        "@type": "PostalAddress",
        addressLocality: BUSINESS.city,
        addressCountry: BUSINESS.country,
      },
      areaServed: [
        {
          "@type": "City",
          name: "Gaziantep",
        },
        {
          "@type": "Country",
          name: "Türkiye",
        },
      ],
      hasMap: BUSINESS.mapsUrl,
      sameAs: [BUSINESS.instagram, BUSINESS.mapsUrl],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${url}#organization`,
      name: BUSINESS.name,
      url,
      logo,
      telephone: BUSINESS.telephone,
      sameAs: [BUSINESS.instagram],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${url}#website`,
      name: BUSINESS.name,
      url,
      publisher: {
        "@id": `${url}#organization`,
      },
      inLanguage: ["tr-TR", "en-US"],
    },
  ];
}

export function createBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
