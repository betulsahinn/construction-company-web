import { prisma } from "@/lib/prisma";
import { ProjectFilterGrid } from "@/components/projects/ProjectFilterGrid";
import { getServerLanguage } from "@/lib/i18n-server";
import { toLanguageUppercase, translations } from "@/lib/i18n";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  const language = await getServerLanguage();
  const seo = pageSeo[language].projects;

  return createPageMetadata({
    title: seo.title,
    description: seo.description,
    path: "/projects",
    language,
  });
}

async function getProjects() {
  return prisma.project.findMany({
    where: { published: true },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      categories: { include: { category: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

async function getCategories() {
  return prisma.category.findMany({
    where: { projects: { some: { project: { published: true } } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export default async function ProjectsPage() {
  const [language, projects, categories] = await Promise.all([
    getServerLanguage(),
    getProjects(),
    getCategories(),
  ]);
  const t = translations[language];

  return (
    <section className="px-6 pb-24 pt-36 md:px-10 md:pb-32 md:pt-40">
      <div className="studio-container">
        <div className="max-w-[680px]">
          <p className="eyebrow">{toLanguageUppercase(t.projects.eyebrow, language)}</p>
          <h1 className="mt-6 font-display text-6xl leading-none tracking-[0.01em] md:text-[5.25rem]">
            {t.projects.title}
          </h1>
          <p className="mt-8 text-lg leading-8 text-warm-gray">
            {t.projects.intro}
          </p>
        </div>

        {projects.length === 0 ? (
          <p className="mt-12 text-warm-gray">{t.common.noPublishedProjects}</p>
        ) : (
          <ProjectFilterGrid projects={projects} categories={categories} language={language} />
        )}
      </div>
    </section>
  );
}
