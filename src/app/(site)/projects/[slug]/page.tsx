import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MasonryGallery } from "@/components/projects/MasonryGallery";
import { JsonLd } from "@/components/seo/JsonLd";
import { getServerLanguage } from "@/lib/i18n-server";
import {
  getProjectDescription,
  getProjectTitle,
  getCategoryLabel,
  toLanguageUppercase,
  translations,
} from "@/lib/i18n";
import { generateProjectImageAlt } from "@/lib/image-alt";
import {
  absoluteUrl,
  createBreadcrumbJsonLd,
  createProjectMetadata,
  pageSeo,
} from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const [language, project] = await Promise.all([
    getServerLanguage(),
    prisma.project.findFirst({
      where: { slug, published: true },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        categories: { include: { category: true } },
      },
    }),
  ]);

  if (!project) return { title: "Project Not Found" };

  const title = getProjectTitle(project, language);
  const categories = project.categories.map(({ category }) => getCategoryLabel(category, language));
  const fallbackDescription =
    language === "tr"
      ? `${title}, Mehmet Eser Interior Design Studio tarafından Gaziantep'te hazırlanan iç mimarlık ve tasarım projesi.`
      : `${title}, an interior architecture and design project by Mehmet Eser Interior Design Studio in Gaziantep, Türkiye.`;
  const description = getProjectDescription(project, language) ?? fallbackDescription;
  const coverImage = getProjectCoverImage(project.images[0]);

  return createProjectMetadata({
    title,
    description: categories.length ? `${description} ${categories.join(", ")}.` : description,
    slug: project.slug,
    language,
    image: coverImage,
  });
}

async function getProject(slug: string) {
  return prisma.project.findFirst({
    where: { slug, published: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      categories: { include: { category: true } },
    },
  });
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [language, project] = await Promise.all([getServerLanguage(), getProject(slug)]);

  if (!project) notFound();

  const t = translations[language];
  const title = getProjectTitle(project, language);
  const description = getProjectDescription(project, language);
  const categories = project.categories.map(({ category }) => category);
  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: pageSeo[language].home.title, url: absoluteUrl("/") },
    { name: translations[language].projects.title, url: absoluteUrl("/projects") },
    { name: title, url: absoluteUrl(`/projects/${project.slug}`) },
  ]);
  const galleryImages = project.images.map((image, index) => ({
    ...image,
    alt: generateProjectImageAlt({
      title: project.title,
      titleTr: project.titleTr,
      titleEn: project.titleEn,
      categories,
      order: index + 1,
      existingAlt: image.alt,
      language,
    }),
  }));

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <article className="px-6 pb-24 pt-36 md:px-10 md:pb-32 md:pt-40">
        <div className="studio-container">
          <Link href="/projects" className="studio-link">
            {t.common.backToProjects}
          </Link>

          <header className="mt-10 border-b border-stone pb-12">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[0.68rem] font-semibold uppercase tracking-[0.36em] text-accent">
              {project.categories.map(({ category }) => (
                <span key={category.id}>{toLanguageUppercase(getCategoryLabel(category, language), language)}</span>
              ))}
              {project.location && <span>{project.location}</span>}
              {project.year && <span>{project.year}</span>}
            </div>
            <h1 className="mt-7 max-w-4xl font-display text-6xl leading-none tracking-[0.01em] md:text-[5.6rem]">
              {title}
            </h1>
            {description && (
              <p className="mt-8 max-w-2xl text-lg leading-9 text-warm-gray">
                {description}
              </p>
            )}
            {project.pdfUrl && (
              <a
                href={project.pdfUrl}
                download
                className="mt-10 inline-flex border border-charcoal px-7 py-4 text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-charcoal transition-colors hover:border-accent hover:bg-accent hover:text-charcoal"
              >
                {t.common.downloadPdf}
              </a>
            )}
          </header>

          <div className="mt-12">
            <MasonryGallery images={galleryImages} language={language} />
          </div>
        </div>
      </article>
    </>
  );
}

function getProjectCoverImage(
  image?: { webUrl: string | null; thumbnailUrl: string | null; url: string; originalUrl: string | null } | null,
) {
  if (!image) return null;

  return image.webUrl ?? image.thumbnailUrl ?? image.url ?? image.originalUrl;
}
