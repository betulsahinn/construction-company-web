import { AboutImage } from "@/components/AboutImage";
import { getServerLanguage } from "@/lib/i18n-server";
import { BRAND_NAME, toLanguageUppercase } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import {
  ABOUT_SETTINGS_ID,
  getLocalizedAbout,
  resolveAboutSettings,
} from "@/lib/site-settings";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  const language = await getServerLanguage();
  const seo = pageSeo[language].about;

  return createPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/about",
    language,
  });
}

export default async function AboutPage() {
  const [language, settingsRecord] = await Promise.all([
    getServerLanguage(),
    prisma.aboutPage.findUnique({ where: { id: ABOUT_SETTINGS_ID } }),
  ]);
  const settings = resolveAboutSettings(settingsRecord);
  const about = getLocalizedAbout(settings, language);

  return (
    <>
      <section className="px-6 pb-24 pt-36 md:px-10 md:pb-32 md:pt-40">
        <div className="studio-container grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow">{toLanguageUppercase(about.eyebrow, language)}</p>
            <h1 className="mt-7 max-w-[560px] font-display text-6xl leading-[0.95] tracking-[0.01em] md:text-[5.2rem]">
              {about.title}
            </h1>
            <p className="mt-10 max-w-xl text-lg leading-8 text-warm-gray">
              {about.description}
            </p>
          </div>

          <AboutImage
            imageWebUrl={settings.imageWebUrl}
            imageThumbnailUrl={settings.imageThumbnailUrl}
            imageOriginalUrl={settings.imageOriginalUrl}
            imageUrl={settings.imageUrl}
            alt={`${BRAND_NAME} construction company`}
          />
        </div>
      </section>

      <section className="border-y border-stone/60 bg-[#f8f5ef] px-6 py-24 text-charcoal md:px-10 md:py-28">
        <div className="studio-container">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.36em] text-accent">
            {toLanguageUppercase(about.approachLabel, language)}
          </p>
          <h2 className="mt-6 max-w-3xl font-display text-5xl leading-tight tracking-[0.01em] md:text-[4.5rem]">
            {about.approachTitle}
          </h2>
          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {about.items.map((item) => (
              <div key={item.title}>
                <h3 className="font-display text-3xl text-charcoal">{item.title}</h3>
                <p className="mt-5 leading-8 text-warm-gray">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
