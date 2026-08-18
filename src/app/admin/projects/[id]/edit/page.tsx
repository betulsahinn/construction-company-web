import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { getOrderedCategories } from "@/lib/category-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getProject(id: string) {
  const [project, categories] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        categories: { include: { category: true } },
      },
    }),
    getOrderedCategories(),
  ]);

  return { project, categories };
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const { project, categories } = await getProject(id);

  if (!project) notFound();

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3">
        <Link href="/admin/projects" className="text-sm text-accent transition-colors hover:text-charcoal">
          &larr; Back to Projects
        </Link>
        <h1 className="font-display text-3xl tracking-wide">Edit Project</h1>
      </div>
      <ProjectForm
        mode="edit"
        initialData={{
          id: project.id,
          title: project.title,
          titleTr: project.titleTr ?? project.title,
          titleEn: project.titleEn ?? "",
          slug: project.slug,
          description: project.description ?? "",
          descriptionTr: project.descriptionTr ?? project.description ?? "",
          descriptionEn: project.descriptionEn ?? "",
          location: project.location ?? "",
          year: project.year ? String(project.year) : "",
          categoryIds: project.categories.map(({ category }) => category.id),
          videoUrl: project.pdfUrl,
          featured: project.featured,
          published: project.published,
          sortOrder: project.sortOrder,
          images: project.images,
        }}
        categories={categories}
      />
    </div>
  );
}
