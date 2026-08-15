import type { Metadata } from "next";
import { BRAND_NAME, type Language } from "@/lib/i18n";

export const SITE_URL = "https://icmimarmehmeteser.com";
export const DEFAULT_OG_IMAGE = "/og/mehmet-eser-og.png";
export const LOGO_IMAGE = "/brand/mehmet-eser-logo.png";

export const BUSINESS = {
  name: BRAND_NAME,
  category: "Interior architecture and design studio",
  city: "Gaziantep",
  country: "Türkiye",
  telephone: "+90 544 275 15 95",
  instagram: "https://www.instagram.com/icmimarmehmeteser/",
  mapsUrl: "https://maps.app.goo.gl/EnqeuKL5mmkkrtji6",
} as const;

export const DEFAULT_SEO = {
  title: BRAND_NAME,
  description:
    "Mehmet Eser Interior Design Studio is a Gaziantep-based interior architecture and design studio creating refined residential, commercial, and facade design projects.",
} as const;

export const pageSeo: Record<
  Language,
  Record<"home" | "projects" | "about" | "references" | "faq" | "contact", { title: string; description: string }>
> = {
  tr: {
    home: {
      title: "Gaziantep İç Mimarlık ve Tasarım Stüdyosu",
      description:
        "Gaziantep merkezli Mehmet Eser Interior Design Studio; iç mimarlık, lüks villa, ticari mekan, cephe tasarımı ve mimari render projeleri üretir.",
    },
    projects: {
      title: "Projeler",
      description:
        "Mehmet Eser Interior Design Studio tarafından hazırlanan iç mimarlık, lüks villa, örnek daire, ticari mekan ve cephe tasarımı projelerini inceleyin.",
    },
    about: {
      title: "Biz Kimiz",
      description:
        "Gaziantep merkezli Mehmet Eser Interior Design Studio'nun iç mimarlık yaklaşımı, malzeme dengesi, oran ve zamansız tasarım anlayışı.",
    },
    references: {
      title: "Referanslar",
      description:
        "Mehmet Eser Interior Design Studio'nun iç mimarlık, render sunumu ve konsept geliştirme süreçlerinde birlikte çalıştığı markalar.",
    },
    faq: {
      title: "Sık Sorulan Sorular",
      description:
        "İç mimarlık projeleri, mimari render sunumları, çalışma süreci ve Mehmet Eser Interior Design Studio hakkında sık sorulan sorular.",
    },
    contact: {
      title: "İletişim",
      description:
        "Gaziantep'te iç mimarlık ve tasarım projeniz için Mehmet Eser Interior Design Studio ile iletişime geçin.",
    },
  },
  en: {
    home: {
      title: "Interior Architecture Studio in Gaziantep",
      description:
        "Mehmet Eser Interior Design Studio is a Gaziantep-based interior architecture studio creating refined interiors, luxury villa concepts, commercial spaces, facades, and architectural render presentations.",
    },
    projects: {
      title: "Projects",
      description:
        "Explore selected interior architecture, luxury villa, sample apartment, commercial space, and facade design projects by Mehmet Eser Interior Design Studio.",
    },
    about: {
      title: "About",
      description:
        "Learn about Mehmet Eser Interior Design Studio's Gaziantep-based interior architecture approach to material balance, proportion, and timeless design.",
    },
    references: {
      title: "References",
      description:
        "Selected companies and brands that have worked with Mehmet Eser Interior Design Studio across interior architecture and design presentations.",
    },
    faq: {
      title: "FAQ",
      description:
        "Frequently asked questions about interior architecture projects, architectural render presentations, process, and Mehmet Eser Interior Design Studio.",
    },
    contact: {
      title: "Contact",
      description:
        "Contact Mehmet Eser Interior Design Studio for interior architecture and design projects in Gaziantep, Türkiye.",
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
          alt: `${BRAND_NAME} interior architecture portfolio`,
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
      ? `${title} İç Mimarlık Projesi`
      : `${title} Interior Architecture Project`;

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
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "https://schema.org/Monday",
            "https://schema.org/Tuesday",
            "https://schema.org/Wednesday",
            "https://schema.org/Thursday",
            "https://schema.org/Friday",
          ],
          opens: "09:00",
          closes: "18:00",
        },
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: "https://schema.org/Saturday",
          opens: "09:00",
          closes: "14:00",
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
