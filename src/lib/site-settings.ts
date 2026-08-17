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
  email: string;
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
  email: string;
  instagramUrl: string;
  instagramHandle: string;
};

const TURKUVAZ_MAPS_URL =
  "https://www.google.com/maps/place/Turkuaz+%C4%B0n%C5%9Faat/@37.079272,37.3478044,17z/data=!3m1!4b1!4m6!3m5!1s0x1531e17753425355:0x9a47ff81cec8adc0!8m2!3d37.079272!4d37.3478044!16s%2Fg%2F11hrl38v7m";

export const defaultAboutSettings: AboutSettingsView = {
  eyebrowTr: "Hakkımızda",
  eyebrowEn: "About",
  titleTr: "Güvenilir İnşaat Yaklaşımı",
  titleEn: "A Reliable Construction Approach",
  descriptionTr:
    "Turkuvaz İnşaat, Gaziantep merkezli yapı projelerinde kaliteli uygulama, düzenli süreç yönetimi ve müşteri odaklı iletişime önem veren bir inşaat firmasıdır.",
  descriptionEn:
    "Turkuvaz İnşaat is a Gaziantep-based construction company focused on quality execution, organized project processes, and customer-oriented communication.",
  imageUrl: "/api/uploads/ai-son.png",
  imageOriginalUrl: null,
  imageWebUrl: null,
  imageThumbnailUrl: null,
  imageFileSize: null,
  imageWidth: null,
  imageHeight: null,
  imageMimeType: null,
  approachLabelTr: "Yaklaşım",
  approachLabelEn: "Approach",
  approachTitleTr: "Çalışma yaklaşımı",
  approachTitleEn: "Our approach",
  materialTitleTr: "Kalite",
  materialTitleEn: "Quality",
  materialTextTr: "Projelerde malzeme, uygulama ve detay kararlarının özenli biçimde ele alınmasına odaklanırız.",
  materialTextEn: "We focus on careful handling of material, execution, and detail decisions throughout each project.",
  proportionTitleTr: "Güven",
  proportionTitleEn: "Reliability",
  proportionTextTr: "Süreç boyunca açık iletişim, düzenli takip ve sorumlu proje yürütme anlayışını önemseriz.",
  proportionTextEn: "We value clear communication, consistent follow-up, and responsible project coordination.",
  narrativeTitleTr: "Uygulama",
  narrativeTitleEn: "Execution",
  narrativeTextTr:
    "Modern yapı pratikleriyle uyumlu, planlı ve dikkatli uygulama süreçleri geliştirmeyi hedefleriz.",
  narrativeTextEn:
    "We aim to support planned and attentive construction processes aligned with modern building practices.",
};

export const defaultContactSettings: ContactSettingsView = {
  businessName: "Turkuvaz İnşaat",
  city: "Gaziantep",
  phone: "0543440409",
  email: "info@turkuvazinsaat.com",
  instagramUrl: "https://www.instagram.com/turkuvazinsaat/",
  instagramHandle: "@turkuvazinsaat",
  address: "Pancarlı, Abdulkadir Aksu Blv., 27560 Şehitkamil/Gaziantep, Türkiye",
  mapsUrl: TURKUVAZ_MAPS_URL,
  titleTr: "Projeniz İçin İletişime Geçin",
  titleEn: "Contact Us About Your Project",
  introTr: "Yapı projeniz, teklif talebiniz veya iş birliği konularınız için Turkuvaz İnşaat ile iletişime geçin.",
  introEn: "Contact Turkuvaz İnşaat for your construction project, quote request, or collaboration needs.",
};

export const defaultFooterSettings: FooterSettingsView = {
  brandTitleTr: "Turkuvaz İnşaat",
  brandTitleEn: "Turkuvaz İnşaat",
  descriptionTr:
    "Gaziantep merkezli inşaat firması; yapı projelerinde planlı uygulama ve güvenilir süreç yönetimine odaklanır.",
  descriptionEn:
    "Gaziantep-based construction company focused on planned execution and reliable project processes.",
  businessName: defaultContactSettings.businessName,
  city: defaultContactSettings.city,
  address: defaultContactSettings.address,
  mapsUrl: defaultContactSettings.mapsUrl,
  phone: defaultContactSettings.phone,
  email: defaultContactSettings.email,
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
  const effectiveSettings = isLegacyAboutSettings(settings) ? null : settings;
  const imageUrl = effectiveSettings
    ? effectiveSettings.imageWebUrl ?? effectiveSettings.imageUrl ?? null
    : defaultAboutSettings.imageUrl;

  return {
    ...defaultAboutSettings,
    ...effectiveSettings,
    eyebrowTr: textValue(effectiveSettings?.eyebrowTr, defaultAboutSettings.eyebrowTr),
    eyebrowEn: textValue(effectiveSettings?.eyebrowEn, defaultAboutSettings.eyebrowEn),
    titleTr: textValue(effectiveSettings?.titleTr, defaultAboutSettings.titleTr),
    titleEn: textValue(effectiveSettings?.titleEn, defaultAboutSettings.titleEn),
    descriptionTr: textValue(effectiveSettings?.descriptionTr, defaultAboutSettings.descriptionTr),
    descriptionEn: textValue(effectiveSettings?.descriptionEn, defaultAboutSettings.descriptionEn),
    imageUrl,
    approachLabelTr: textValue(effectiveSettings?.approachLabelTr, defaultAboutSettings.approachLabelTr),
    approachLabelEn: textValue(effectiveSettings?.approachLabelEn, defaultAboutSettings.approachLabelEn),
    approachTitleTr: textValue(effectiveSettings?.approachTitleTr, defaultAboutSettings.approachTitleTr),
    approachTitleEn: textValue(effectiveSettings?.approachTitleEn, defaultAboutSettings.approachTitleEn),
    materialTitleTr: textValue(effectiveSettings?.materialTitleTr, defaultAboutSettings.materialTitleTr),
    materialTitleEn: textValue(effectiveSettings?.materialTitleEn, defaultAboutSettings.materialTitleEn),
    materialTextTr: textValue(effectiveSettings?.materialTextTr, defaultAboutSettings.materialTextTr),
    materialTextEn: textValue(effectiveSettings?.materialTextEn, defaultAboutSettings.materialTextEn),
    proportionTitleTr: textValue(effectiveSettings?.proportionTitleTr, defaultAboutSettings.proportionTitleTr),
    proportionTitleEn: textValue(effectiveSettings?.proportionTitleEn, defaultAboutSettings.proportionTitleEn),
    proportionTextTr: textValue(effectiveSettings?.proportionTextTr, defaultAboutSettings.proportionTextTr),
    proportionTextEn: textValue(effectiveSettings?.proportionTextEn, defaultAboutSettings.proportionTextEn),
    narrativeTitleTr: textValue(effectiveSettings?.narrativeTitleTr, defaultAboutSettings.narrativeTitleTr),
    narrativeTitleEn: textValue(effectiveSettings?.narrativeTitleEn, defaultAboutSettings.narrativeTitleEn),
    narrativeTextTr: textValue(effectiveSettings?.narrativeTextTr, defaultAboutSettings.narrativeTextTr),
    narrativeTextEn: textValue(effectiveSettings?.narrativeTextEn, defaultAboutSettings.narrativeTextEn),
  };
}

export function resolveContactSettings(settings: ContactSettingsRecord) {
  const effectiveSettings = isLegacyContactSettings(settings) ? null : settings;

  return {
    ...defaultContactSettings,
    ...effectiveSettings,
    businessName: textValue(effectiveSettings?.businessName, defaultContactSettings.businessName),
    city: textValue(effectiveSettings?.city, defaultContactSettings.city),
    phone: textValue(effectiveSettings?.phone, defaultContactSettings.phone),
    email: textValue(effectiveSettings?.email, defaultContactSettings.email),
    instagramUrl: textValue(effectiveSettings?.instagramUrl, defaultContactSettings.instagramUrl),
    instagramHandle: textValue(effectiveSettings?.instagramHandle, defaultContactSettings.instagramHandle),
    address: textValue(effectiveSettings?.address, defaultContactSettings.address),
    mapsUrl: textValue(effectiveSettings?.mapsUrl, defaultContactSettings.mapsUrl),
    titleTr: textValue(effectiveSettings?.titleTr, defaultContactSettings.titleTr),
    titleEn: textValue(effectiveSettings?.titleEn, defaultContactSettings.titleEn),
    introTr: textValue(effectiveSettings?.introTr, defaultContactSettings.introTr),
    introEn: textValue(effectiveSettings?.introEn, defaultContactSettings.introEn),
  };
}

export function resolveFooterSettings(settings: FooterSettingsRecord, contactSettings?: ContactSettingsView) {
  const contact = contactSettings ?? defaultContactSettings;
  const effectiveSettings = isLegacyFooterSettings(settings) ? null : settings;

  return {
    ...defaultFooterSettings,
    ...effectiveSettings,
    brandTitleTr: textValue(effectiveSettings?.brandTitleTr, defaultFooterSettings.brandTitleTr),
    brandTitleEn: textValue(effectiveSettings?.brandTitleEn, defaultFooterSettings.brandTitleEn),
    descriptionTr: textValue(effectiveSettings?.descriptionTr, defaultFooterSettings.descriptionTr),
    descriptionEn: textValue(effectiveSettings?.descriptionEn, defaultFooterSettings.descriptionEn),
    businessName: nonEmptyTextValue(effectiveSettings?.businessName, contact.businessName),
    city: nonEmptyTextValue(effectiveSettings?.city, contact.city),
    address: nonEmptyTextValue(effectiveSettings?.address, defaultFooterSettings.address),
    mapsUrl: nonEmptyTextValue(effectiveSettings?.mapsUrl, contact.mapsUrl || defaultFooterSettings.mapsUrl),
    phone: nonEmptyTextValue(effectiveSettings?.phone, contact.phone),
    email: nonEmptyTextValue(effectiveSettings?.email, contact.email),
    instagramUrl: nonEmptyTextValue(effectiveSettings?.instagramUrl, contact.instagramUrl),
    instagramHandle: nonEmptyTextValue(effectiveSettings?.instagramHandle, contact.instagramHandle),
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

export function getEmailHref(email: string) {
  return `mailto:${email.trim()}`;
}

function containsLegacyBrand(value?: string | null) {
  return Boolean(value && /Mehmet Eser|Interior|Architecture|architecture|iç mimarlık|icmimarmehmeteser/i.test(value));
}

function containsLegacyMedia(value?: string | null) {
  return Boolean(value && /architecture-/i.test(value));
}

function isLegacyAboutSettings(settings: AboutSettingsRecord) {
  return Boolean(
    settings &&
      (containsLegacyBrand(settings.titleTr) ||
        containsLegacyBrand(settings.titleEn) ||
        containsLegacyBrand(settings.descriptionTr) ||
        containsLegacyBrand(settings.descriptionEn) ||
        containsLegacyMedia(settings.imageUrl)),
  );
}

function isLegacyContactSettings(settings: ContactSettingsRecord) {
  return Boolean(
    settings &&
      (containsLegacyBrand(settings.businessName) ||
        containsLegacyBrand(settings.instagramUrl) ||
        containsLegacyBrand(settings.instagramHandle)),
  );
}

function isLegacyFooterSettings(settings: FooterSettingsRecord) {
  return Boolean(
    settings &&
      (containsLegacyBrand(settings.brandTitleTr) ||
        containsLegacyBrand(settings.brandTitleEn) ||
        containsLegacyBrand(settings.descriptionTr) ||
        containsLegacyBrand(settings.descriptionEn) ||
        containsLegacyBrand(settings.instagramUrl) ||
        containsLegacyBrand(settings.instagramHandle)),
  );
}
