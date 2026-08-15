import { prisma } from "@/lib/prisma";
import { HomepageHeroForm } from "@/components/admin/HomepageHeroForm";
import { BRAND_NAME } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HERO_ID = "homepage";
const HERO_BRAND_TITLE = "Mehmet Eser\nInterior Design Studio";
const LEGACY_HERO_TITLES = [
  "Horizon Residence",
  "Mehmet Eser",
  "Mehmet Eser\nInterior Design\nStudio",
  BRAND_NAME,
];

async function getHero() {
  const hero = await prisma.homepageHero.findUnique({ where: { id: HERO_ID } });
  const savedTitle = hero?.title?.trim();

  return {
    title: savedTitle && !LEGACY_HERO_TITLES.includes(savedTitle) ? savedTitle : HERO_BRAND_TITLE,
    subtitle:
      hero?.subtitle ??
      "A quiet study of light, material, and proportion across a contemporary interior architecture portfolio.",
    ctaLabel: hero?.ctaLabel ?? "View Projects",
    ctaUrl: hero?.ctaUrl ?? "/projects",
    mediaType: hero?.mediaType === "video" ? ("video" as const) : ("image" as const),
    imageUrl: hero
      ? hero.imageWebUrl ?? hero.imageUrl ?? null
      : "/api/uploads/architecture-residence-dusk.png",
    videoUrl: hero?.videoUrl ?? null,
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
