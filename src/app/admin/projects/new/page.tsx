import Link from "next/link";
import { ProjectForm } from "@/components/admin/ProjectForm";
import { getOrderedCategories } from "@/lib/category-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getFormData() {
  const [categories, sortResult] = await Promise.all([
    getOrderedCategories(),
    prisma.project.aggregate({ _max: { sortOrder: true } }),
  ]);

  return {
    categories,
    nextSortOrder: (sortResult._max.sortOrder ?? 0) + 1,
  };
}

export default async function NewProjectPage() {
  const { categories, nextSortOrder } = await getFormData();

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3">
        <Link href="/admin/projects" className="text-sm text-accent transition-colors hover:text-charcoal">
          &larr; Back to Projects
        </Link>
        <h1 className="font-display text-3xl tracking-wide">New Project</h1>
      </div>
      <ProjectForm
        mode="create"
        categories={categories}
        initialData={{
          title: "",
          titleTr: "",
          titleEn: "",
          slug: "",
          description: "",
          descriptionTr: "",
          descriptionEn: "",
          location: "",
          year: "",
          categoryIds: [],
          pdfUrl: null,
          featured: false,
          published: false,
          sortOrder: nextSortOrder,
          images: [],
        }}
      />
    </div>
  );
}
