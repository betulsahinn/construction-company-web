import { SmartImage } from "@/components/SmartImage";
import { prisma } from "@/lib/prisma";
import { getServerLanguage } from "@/lib/i18n-server";
import { toLanguageUppercase, translations } from "@/lib/i18n";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const language = await getServerLanguage();
  const seo = pageSeo[language].references;

  return createPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/references",
    language,
  });
}

async function getReferences() {
  return prisma.reference.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { companyName: "asc" }],
  });
}

export default async function ReferencesPage() {
  const [language, references] = await Promise.all([getServerLanguage(), getReferences()]);
  const t = translations[language];

  return (
    <section className="px-6 pb-24 pt-36 md:px-10 md:pb-32 md:pt-40">
      <div className="studio-container">
        <div className="max-w-[760px]">
          <p className="eyebrow">{toLanguageUppercase(t.references.eyebrow, language)}</p>
          <h1 className="mt-7 font-display text-6xl leading-[0.95] tracking-[0.01em] md:text-[5.2rem]">
            {t.references.title}
          </h1>
          <p className="mt-8 text-lg leading-8 text-warm-gray">
            {t.references.intro}
          </p>
        </div>

        {references.length === 0 ? (
          <p className="mt-16 text-warm-gray">{t.references.empty}</p>
        ) : (
          <div className="mt-20 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {references.map((reference) => {
              const logoUrl = reference.logoUrl ?? reference.logoWebUrl ?? reference.logoThumbnailUrl;
              const content = (
                <div className="group flex min-h-[220px] flex-col justify-between border border-stone/70 bg-cream p-8 transition-colors hover:border-accent/50 hover:bg-white">
                  <div className="flex min-h-[96px] items-center justify-center">
                    {logoUrl ? (
                      <div className="relative h-24 w-full">
                        <SmartImage
                          src={logoUrl}
                          sources={[reference.logoWebUrl, reference.logoThumbnailUrl]}
                          alt={`${reference.companyName} logo`}
                          fill
                          className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : (
                      <p className="text-center font-display text-4xl leading-tight tracking-[0.02em]">
                        {reference.companyName}
                      </p>
                    )}
                  </div>
                  <div className="mt-8 flex items-end justify-between gap-5">
                    <p className="text-sm text-warm-gray">{reference.companyName}</p>
                    {reference.websiteUrl && (
                      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-accent">
                        {toLanguageUppercase(t.references.visit, language)}
                      </span>
                    )}
                  </div>
                </div>
              );

              return reference.websiteUrl ? (
                <a key={reference.id} href={reference.websiteUrl} target="_blank" rel="noreferrer" className="block">
                  {content}
                </a>
              ) : (
                <div key={reference.id}>{content}</div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
