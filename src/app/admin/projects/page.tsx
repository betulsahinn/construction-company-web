import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getProjects() {
  return prisma.project.findMany({
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      categories: { include: { category: true } },
      _count: { select: { images: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export default async function AdminProjectsPage() {
  const projects = await getProjects();

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-wide">Projects</h1>
          <p className="mt-1 text-sm text-warm-gray">Manage construction projects</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-block bg-charcoal px-6 py-3 text-sm uppercase tracking-widest text-cream transition-colors hover:bg-accent"
        >
          New Project
        </Link>
      </div>

      <div className="overflow-x-auto border border-stone/60 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-stone/40 bg-stone/10">
            <tr>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Title</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Category</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Status</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Images</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Video</th>
              <th className="px-4 py-3 font-medium uppercase tracking-wider text-warm-gray">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-stone/20 last:border-0">
                <td className="px-4 py-4">
                  <p className="font-medium">{project.titleTr ?? project.title}</p>
                  {project.titleEn && <p className="text-xs text-warm-gray">{project.titleEn}</p>}
                  <p className="text-xs text-warm-gray">{project.slug}</p>
                </td>
                <td className="px-4 py-4 text-warm-gray">
                  {project.categories.map(({ category }) => category.name).join(", ") || "-"}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-block px-2 py-1 text-xs uppercase tracking-wider ${
                      project.published ? "bg-green-100 text-green-800" : "bg-stone/30 text-warm-gray"
                    }`}
                  >
                    {project.published ? "Published" : "Draft"}
                  </span>
                  {project.featured && (
                    <span className="ml-2 inline-block bg-accent/20 px-2 py-1 text-xs uppercase tracking-wider text-accent">
                      Featured
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-warm-gray">{project._count.images}</td>
                <td className="px-4 py-4 text-warm-gray">{project.pdfUrl ? "Yes" : "-"}</td>
                <td className="px-4 py-4">
                  <Link href={`/admin/projects/${project.id}/edit`} className="text-accent transition-colors hover:text-charcoal">
                    Edit
                  </Link>
                  {project.published && (
                    <>
                      {" - "}
                      <Link href={`/projects/${project.slug}`} className="text-warm-gray transition-colors hover:text-accent" target="_blank">
                        View
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {projects.length === 0 && (
          <p className="p-8 text-center text-warm-gray">No projects yet. Create your first project.</p>
        )}
      </div>
    </div>
  );
}
