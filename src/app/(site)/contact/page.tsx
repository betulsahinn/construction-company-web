import type { ReactNode } from "react";
import { getServerLanguage } from "@/lib/i18n-server";
import { BRAND_NAME, toLanguageUppercase, translations } from "@/lib/i18n";
import { ContactForm } from "@/components/contact/ContactForm";
import { prisma } from "@/lib/prisma";
import {
  CONTACT_SETTINGS_ID,
  getLocalizedContact,
  getMapsUrl,
  getPhoneHref,
  resolveContactSettings,
} from "@/lib/site-settings";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const language = await getServerLanguage();
  const seo = pageSeo[language].contact;

  return createPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/contact",
    language,
  });
}

export default async function ContactPage() {
  const [language, settingsRecord] = await Promise.all([
    getServerLanguage(),
    prisma.contactPage.findUnique({ where: { id: CONTACT_SETTINGS_ID } }),
  ]);
  const t = translations[language];
  const settings = resolveContactSettings(settingsRecord);
  const contact = getLocalizedContact(settings, language);
  const mapsUrl = getMapsUrl(settings);
  const phoneHref = getPhoneHref(settings.phone);

  return (
    <section className="px-6 pb-24 pt-36 md:px-10 md:pb-32 md:pt-40">
      <div className="studio-container">
        <div className="max-w-[720px]">
          <p className="eyebrow">{toLanguageUppercase(t.contact.eyebrow, language)}</p>
          <h1 className="mt-7 font-display text-6xl leading-[0.95] tracking-[0.01em] md:text-[5.2rem]">
            {contact.title}
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-warm-gray">
            {contact.intro}
          </p>
        </div>

        <div className="mt-16 grid gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20">
          <div className="border-y border-stone py-2">
            <ContactRow label={toLanguageUppercase(t.contact.business, language)} value={settings.businessName || BRAND_NAME} />
            <ContactRow label={toLanguageUppercase(t.contact.city, language)} value={settings.city} />
            <ContactRow
              label={toLanguageUppercase(t.contact.phone, language)}
              value={
                <a href={phoneHref} className="transition-colors hover:text-accent">
                  {settings.phone}
                </a>
              }
            />
            <ContactRow
              label={toLanguageUppercase(t.contact.instagram, language)}
              value={
                <a
                  href={settings.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-accent"
                >
                  {settings.instagramHandle}
                </a>
              }
            />
            <ContactRow
              label={toLanguageUppercase(t.contact.address, language)}
              value={
                <span>
                  {settings.address}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 block text-[0.68rem] font-semibold uppercase tracking-[0.36em] text-accent transition-colors hover:text-charcoal"
                  >
                    {t.contact.openMaps}
                  </a>
                </span>
              }
            />
          </div>

          <ContactForm
            labels={{
              formTitle: t.contact.formTitle,
              name: t.contact.name,
              email: t.contact.email,
              phone: t.contact.phone,
              message: t.contact.message,
              send: t.contact.send,
            }}
          />
        </div>
      </div>
    </section>
  );
}

function ContactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-4 border-t border-stone py-8 first:border-t-0 md:grid-cols-[132px_1fr]">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.36em] text-accent">
        {label}
      </p>
      <div className="max-w-[560px] text-base leading-8 text-charcoal">{value}</div>
    </div>
  );
}
