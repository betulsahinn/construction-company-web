import { CategoryManager } from "@/components/admin/CategoryManager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getCategories() {
  return prisma.category.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-wide">Categories</h1>
        <p className="mt-1 text-sm text-warm-gray">Manage multilingual project categories used by the public filters and project forms.</p>
      </div>
      <CategoryManager initialCategories={categories} />
    </div>
  );
}
