import type { Language } from "./i18n";

export const ABOUT_SETTINGS_ID = "about";
export const CONTACT_SETTINGS_ID = "contact";
export const FOOTER_SETTINGS_ID = "footer";

export type AboutSettingsView = {
  eyebrowTr: string;
  eyebrowEn: string;
  titleTr: string;
  titleEn: string;
  descriptionTr: string;
  descriptionEn: string;
  imageUrl: string | null;
  imageOriginalUrl: string | null;
  imageWebUrl: string | null;
  imageThumbnailUrl: string | null;
  imageFileSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageMimeType: string | null;
  approachLabelTr: string;
  approachLabelEn: string;
  approachTitleTr: string;
  approachTitleEn: string;
  materialTitleTr: string;
  materialTitleEn: string;
  materialTextTr: string;
  materialTextEn: string;
  proportionTitleTr: string;
  proportionTitleEn: string;
  proportionTextTr: string;
  proportionTextEn: string;
  narrativeTitleTr: string;
  narrativeTitleEn: string;
  narrativeTextTr: string;
  narrativeTextEn: string;
};

export type ContactSettingsView = {
  businessName: string;
  city: string;
  phone: string;
  instagramUrl: string;
  instagramHandle: string;
  address: string;
  mapsUrl: string;
  titleTr: string;
  titleEn: string;
  introTr: string;
  introEn: string;
};

export type FooterSettingsView = {
  brandTitleTr: string;
  brandTitleEn: string;
  descriptionTr: string;
  descriptionEn: string;
  businessName: string;
  city: string;
  address: string;
  mapsUrl: string;
  phone: string;
  instagramUrl: string;
  instagramHandle: string;
};

export const defaultAboutSettings: AboutSettingsView = {
  eyebrowTr: "Stüdyo",
  eyebrowEn: "Our Studio",
  titleTr: "Zamansız Bir Görsel Denge",
  titleEn: "Design With Enduring Presence",
  descriptionTr:
    "2020 yılında kurulan Mehmet Eser Interior Design Studio, Gaziantep merkezli bir iç mimarlık stüdyosudur. Malzeme dengesi, oran, detay kalitesi ve zamansız görsel anlatım odağında iç mekan tasarımları, mimari render sunumları ve konsept projeler üretir.",
  descriptionEn:
    "Founded in 2020, Mehmet Eser Interior Design Studio is an interior architecture studio based in Gaziantep, creating refined interiors, architectural render presentations, and design concepts with a focus on material clarity, proportion, and timeless visual quality.",
  imageUrl: "/api/uploads/architecture-interior-gallery.png",
  imageOriginalUrl: null,
  imageWebUrl: null,
  imageThumbnailUrl: null,
  imageFileSize: null,
  imageWidth: null,
  imageHeight: null,
  imageMimeType: null,
  approachLabelTr: "Yaklaşım",
  approachLabelEn: "Method",
  approachTitleTr: "Tasarım yaklaşımı",
  approachTitleEn: "Our approach",
  materialTitleTr: "Malzeme",
  materialTitleEn: "Material",
  materialTextTr: "Her projede dokuların, renklerin ve yüzeylerin dengeli bir bütün oluşturmasına odaklanırız.",
  materialTextEn: "We focus on balanced textures, color, and surfaces that form a calm architectural whole.",
  proportionTitleTr: "Oran",
  proportionTitleEn: "Proportion",
  proportionTextTr: "Mekan kurgusunu insan ölçeği, akış ve görsel sakinlik üzerinden rafine ederiz.",
  proportionTextEn: "Spatial decisions are refined through human scale, flow, and visual restraint.",
  narrativeTitleTr: "Anlatım",
  narrativeTitleEn: "Narrative",
  narrativeTextTr:
    "Render sunumları ve konsept görsellerle tasarım fikrini net, güçlü ve zamansız biçimde aktarırız.",
  narrativeTextEn:
    "Render presentations and concept visuals communicate each design idea with clarity and permanence.",
};

export const defaultContactSettings: ContactSettingsView = {
  businessName: "Mehmet Eser Interior Design Studio",
  city: "Gaziantep",
  phone: "0544 275 15 95",
  instagramUrl: "https://www.instagram.com/icmimarmehmeteser/",
  instagramHandle: "@icmimarmehmeteser",
  address: "15 Temmuz, 148171 SK NO · 11C T Blok. No:10, 27100 Şehitkamil/Gaziantep",
  mapsUrl: "https://maps.app.goo.gl/EnqeuKL5mmkkrtji6",
  titleTr: "Birlikte Özel Bir Mekan Tasarlayalım",
  titleEn: "Let's Create Something Extraordinary",
  introTr: "Projenizi, ihtiyaçlarınızı ve mekana dair hedeflerinizi paylaşmak için bizimle iletişime geçin.",
  introEn: "Share your project, spatial goals, and design needs with the studio.",
};

export const defaultFooterSettings: FooterSettingsView = {
  brandTitleTr: "Mehmet Eser Interior Design Studio",
  brandTitleEn: "Mehmet Eser Interior Design Studio",
  descriptionTr:
    "Gaziantep merkezli iç mimarlık stüdyosu; malzeme, oran ve sakin detaylarla rafine mekanlar tasarlar.",
  descriptionEn:
    "Interior design studio based in Gaziantep, creating refined spaces through material balance, proportion, and quiet detail.",
  businessName: defaultContactSettings.businessName,
  city: defaultContactSettings.city,
  address: "15 Temmuz, Şehitkamil / Gaziantep",
  mapsUrl: "https://maps.app.goo.gl/EnqeuKL5mmkkrtji6",
  phone: defaultContactSettings.phone,
  instagramUrl: defaultContactSettings.instagramUrl,
  instagramHandle: defaultContactSettings.instagramHandle,
};

type NullableRecord<T> = {
  [K in keyof T]?: T[K] | null;
};

type AboutSettingsRecord = NullableRecord<AboutSettingsView> | null;
type ContactSettingsRecord = NullableRecord<ContactSettingsView> | null;
type FooterSettingsRecord = NullableRecord<FooterSettingsView> | null;

function textValue(value: string | null | undefined, fallback: string) {
  return value ?? fallback;
}

function nonEmptyTextValue(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

export function resolveAboutSettings(settings: AboutSettingsRecord) {
  const imageUrl = settings
    ? settings.imageWebUrl ?? settings.imageUrl ?? null
    : defaultAboutSettings.imageUrl;

  return {
    ...defaultAboutSettings,
    ...settings,
    eyebrowTr: textValue(settings?.eyebrowTr, defaultAboutSettings.eyebrowTr),
    eyebrowEn: textValue(settings?.eyebrowEn, defaultAboutSettings.eyebrowEn),
    titleTr: textValue(settings?.titleTr, defaultAboutSettings.titleTr),
    titleEn: textValue(settings?.titleEn, defaultAboutSettings.titleEn),
    descriptionTr: textValue(settings?.descriptionTr, defaultAboutSettings.descriptionTr),
    descriptionEn: textValue(settings?.descriptionEn, defaultAboutSettings.descriptionEn),
    imageUrl,
    approachLabelTr: textValue(settings?.approachLabelTr, defaultAboutSettings.approachLabelTr),
    approachLabelEn: textValue(settings?.approachLabelEn, defaultAboutSettings.approachLabelEn),
    approachTitleTr: textValue(settings?.approachTitleTr, defaultAboutSettings.approachTitleTr),
    approachTitleEn: textValue(settings?.approachTitleEn, defaultAboutSettings.approachTitleEn),
    materialTitleTr: textValue(settings?.materialTitleTr, defaultAboutSettings.materialTitleTr),
    materialTitleEn: textValue(settings?.materialTitleEn, defaultAboutSettings.materialTitleEn),
    materialTextTr: textValue(settings?.materialTextTr, defaultAboutSettings.materialTextTr),
    materialTextEn: textValue(settings?.materialTextEn, defaultAboutSettings.materialTextEn),
    proportionTitleTr: textValue(settings?.proportionTitleTr, defaultAboutSettings.proportionTitleTr),
    proportionTitleEn: textValue(settings?.proportionTitleEn, defaultAboutSettings.proportionTitleEn),
    proportionTextTr: textValue(settings?.proportionTextTr, defaultAboutSettings.proportionTextTr),
    proportionTextEn: textValue(settings?.proportionTextEn, defaultAboutSettings.proportionTextEn),
    narrativeTitleTr: textValue(settings?.narrativeTitleTr, defaultAboutSettings.narrativeTitleTr),
    narrativeTitleEn: textValue(settings?.narrativeTitleEn, defaultAboutSettings.narrativeTitleEn),
    narrativeTextTr: textValue(settings?.narrativeTextTr, defaultAboutSettings.narrativeTextTr),
    narrativeTextEn: textValue(settings?.narrativeTextEn, defaultAboutSettings.narrativeTextEn),
  };
}

export function resolveContactSettings(settings: ContactSettingsRecord) {
  return {
    ...defaultContactSettings,
    ...settings,
    businessName: textValue(settings?.businessName, defaultContactSettings.businessName),
    city: textValue(settings?.city, defaultContactSettings.city),
    phone: textValue(settings?.phone, defaultContactSettings.phone),
    instagramUrl: textValue(settings?.instagramUrl, defaultContactSettings.instagramUrl),
    instagramHandle: textValue(settings?.instagramHandle, defaultContactSettings.instagramHandle),
    address: textValue(settings?.address, defaultContactSettings.address),
    mapsUrl: textValue(settings?.mapsUrl, defaultContactSettings.mapsUrl),
    titleTr: textValue(settings?.titleTr, defaultContactSettings.titleTr),
    titleEn: textValue(settings?.titleEn, defaultContactSettings.titleEn),
    introTr: textValue(settings?.introTr, defaultContactSettings.introTr),
    introEn: textValue(settings?.introEn, defaultContactSettings.introEn),
  };
}

export function resolveFooterSettings(settings: FooterSettingsRecord, contactSettings?: ContactSettingsView) {
  const contact = contactSettings ?? defaultContactSettings;

  return {
    ...defaultFooterSettings,
    ...settings,
    brandTitleTr: textValue(settings?.brandTitleTr, defaultFooterSettings.brandTitleTr),
    brandTitleEn: textValue(settings?.brandTitleEn, defaultFooterSettings.brandTitleEn),
    descriptionTr: textValue(settings?.descriptionTr, defaultFooterSettings.descriptionTr),
    descriptionEn: textValue(settings?.descriptionEn, defaultFooterSettings.descriptionEn),
    businessName: nonEmptyTextValue(settings?.businessName, contact.businessName),
    city: nonEmptyTextValue(settings?.city, contact.city),
    address: nonEmptyTextValue(settings?.address, defaultFooterSettings.address),
    mapsUrl: nonEmptyTextValue(settings?.mapsUrl, contact.mapsUrl || defaultFooterSettings.mapsUrl),
    phone: nonEmptyTextValue(settings?.phone, contact.phone),
    instagramUrl: nonEmptyTextValue(settings?.instagramUrl, contact.instagramUrl),
    instagramHandle: nonEmptyTextValue(settings?.instagramHandle, contact.instagramHandle),
  };
}

export function getLocalizedAbout(settings: ReturnType<typeof resolveAboutSettings>, language: Language) {
  return {
    eyebrow: language === "tr" ? settings.eyebrowTr : settings.eyebrowEn,
    title: language === "tr" ? settings.titleTr : settings.titleEn,
    description: language === "tr" ? settings.descriptionTr : settings.descriptionEn,
    approachLabel: language === "tr" ? settings.approachLabelTr : settings.approachLabelEn,
    approachTitle: language === "tr" ? settings.approachTitleTr : settings.approachTitleEn,
    items: [
      {
        title: language === "tr" ? settings.materialTitleTr : settings.materialTitleEn,
        text: language === "tr" ? settings.materialTextTr : settings.materialTextEn,
      },
      {
        title: language === "tr" ? settings.proportionTitleTr : settings.proportionTitleEn,
        text: language === "tr" ? settings.proportionTextTr : settings.proportionTextEn,
      },
      {
        title: language === "tr" ? settings.narrativeTitleTr : settings.narrativeTitleEn,
        text: language === "tr" ? settings.narrativeTextTr : settings.narrativeTextEn,
      },
    ],
  };
}

export function getLocalizedContact(settings: ReturnType<typeof resolveContactSettings>, language: Language) {
  return {
    title: language === "tr" ? settings.titleTr : settings.titleEn,
    intro: language === "tr" ? settings.introTr : settings.introEn,
  };
}

export function getLocalizedFooter(settings: ReturnType<typeof resolveFooterSettings>, language: Language) {
  return {
    brandTitle: language === "tr" ? settings.brandTitleTr : settings.brandTitleEn,
    description: language === "tr" ? settings.descriptionTr : settings.descriptionEn,
  };
}

export function getMapsUrl(settings: ReturnType<typeof resolveContactSettings>) {
  if (settings.mapsUrl) return settings.mapsUrl;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${settings.businessName} ${settings.address}`,
  )}`;
}

export function getPhoneHref(phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("90")) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+90${digits.slice(1)}`;
  return `tel:${phone.replace(/\s/g, "")}`;
}
