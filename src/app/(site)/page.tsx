import { HeroMedia } from "@/components/home/HeroMedia";
import { HeroContent } from "@/components/home/HeroContent";
import { prisma } from "@/lib/prisma";
import { getServerLanguage } from "@/lib/i18n-server";
import { translations } from "@/lib/i18n";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HERO_ID = "homepage";
const DEFAULT_HERO_IMAGE = "/api/uploads/ai-son.png";

export async function generateMetadata() {
  const language = await getServerLanguage();
  const seo = pageSeo[language].home;

  return createPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/",
    language,
  });
}

async function getHeroSettings() {
  const [language, settings] = await Promise.all([
    getServerLanguage(),
    prisma.homepageHero.findUnique({ where: { id: HERO_ID } }),
  ]);

  const t = translations[language];
  const imageUrl = settings
    ? settings.imageWebUrl ?? settings.imageUrl ?? settings.imageThumbnailUrl ?? settings.imageOriginalUrl ?? null
    : null;
  const legacyHero =
    containsLegacyHeroText(settings?.title) ||
    containsLegacyHeroText(settings?.subtitle) ||
    containsLegacyHeroMedia(imageUrl);

  return {
    eyebrow: t.home.eyebrow.toLocaleUpperCase("en-US"),
    language,
    title: legacyHero ? "Turkuvaz İnşaat" : settings?.title ?? undefined,
    subtitle: legacyHero ? t.home.subtitle : settings?.subtitle ?? undefined,
    ctaLabel: settings?.ctaLabel ?? undefined,
    ctaUrl: settings?.ctaUrl ?? "/projects",
    mediaType: settings?.mediaType === "video" ? ("video" as const) : ("image" as const),
    imageUrl: legacyHero ? DEFAULT_HERO_IMAGE : imageUrl ?? DEFAULT_HERO_IMAGE,
    imageSources: settings
      ? [settings.imageUrl, settings.imageThumbnailUrl, settings.imageOriginalUrl]
      : [],
    videoUrl: legacyHero ? null : settings?.videoUrl ?? null,
  };
}

export default async function HomePage() {
  const hero = await getHeroSettings();

  return (
    <section className="relative h-screen overflow-hidden bg-charcoal">
      <HeroMedia
        mediaType={hero.mediaType}
        imageUrl={hero.imageUrl}
        imageSources={hero.imageSources}
        videoUrl={hero.videoUrl}
      />
      <div className="absolute inset-0 z-10 flex items-center justify-center px-6 pt-16">
        <HeroContent
          title={hero.title}
          eyebrow={hero.eyebrow}
          description={hero.subtitle}
          href={hero.ctaUrl}
          ctaLabel={hero.ctaLabel}
          language={hero.language}
        />
      </div>
    </section>
  );
}

function containsLegacyHeroText(value?: string | null) {
  return Boolean(value && /Mehmet Eser|Interior|Architecture|architecture|Horizon Residence/i.test(value));
}

function containsLegacyHeroMedia(value?: string | null) {
  return Boolean(value && /architecture-/i.test(value));
}
