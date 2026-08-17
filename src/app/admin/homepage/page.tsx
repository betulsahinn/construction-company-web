import { prisma } from "@/lib/prisma";
import { HomepageHeroForm } from "@/components/admin/HomepageHeroForm";
import { BRAND_NAME } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HERO_ID = "homepage";
const HERO_BRAND_TITLE = "Turkuvaz İnşaat";
const LEGACY_HERO_TITLES = [
  "Horizon Residence",
  "Mehmet Eser",
  "Mehmet Eser\nInterior Design\nStudio",
  "Mehmet Eser Interior Design Studio",
  BRAND_NAME,
];
const DEFAULT_HERO_IMAGE = "/api/uploads/ai-son.png";

async function getHero() {
  const hero = await prisma.homepageHero.findUnique({ where: { id: HERO_ID } });
  const savedTitle = hero?.title?.trim();
  const imageUrl = hero ? hero.imageWebUrl ?? hero.imageUrl ?? null : null;
  const legacyHero =
    !savedTitle ||
    LEGACY_HERO_TITLES.includes(savedTitle) ||
    containsLegacyHeroText(hero?.subtitle) ||
    containsLegacyHeroMedia(imageUrl);

  return {
    title: legacyHero ? HERO_BRAND_TITLE : savedTitle,
    subtitle:
      legacyHero || !hero?.subtitle
        ? "A professional construction approach focused on planned, careful, and reliable project execution."
        : hero.subtitle,
    ctaLabel: hero?.ctaLabel ?? "View Projects",
    ctaUrl: hero?.ctaUrl ?? "/projects",
    mediaType: hero?.mediaType === "video" ? ("video" as const) : ("image" as const),
    imageUrl: legacyHero ? DEFAULT_HERO_IMAGE : imageUrl ?? DEFAULT_HERO_IMAGE,
    videoUrl: legacyHero ? null : hero?.videoUrl ?? null,
  };
}

export default async function AdminHomepagePage() {
  const hero = await getHero();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-wide">Homepage Hero</h1>
        <p className="mt-1 text-sm text-warm-gray">Manage the full-screen homepage media and overlay text.</p>
      </div>
      <HomepageHeroForm initialData={hero} />
    </div>
  );
}

function containsLegacyHeroText(value?: string | null) {
  return Boolean(value && /Mehmet Eser|Interior|Architecture|architecture|Horizon Residence/i.test(value));
}

function containsLegacyHeroMedia(value?: string | null) {
  return Boolean(value && /architecture-/i.test(value));
}
