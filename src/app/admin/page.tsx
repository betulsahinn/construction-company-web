import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStorageInfo } from "@/lib/storage";

export const dynamic = "force-dynamic";

async function getStats() {
  const [totalProjects, publishedProjects, draftProjects, totalImages, featuredProjects] =
    await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { published: true } }),
      prisma.project.count({ where: { published: false } }),
      prisma.projectImage.count(),
      prisma.project.count({ where: { featured: true } }),
    ]);

  return { totalProjects, publishedProjects, draftProjects, totalImages, featuredProjects };
}

export default async function AdminDashboardPage() {
  const stats = await getStats();
  const storage = getStorageInfo();

  const cards = [
    { label: "Total Projects", value: stats.totalProjects },
    { label: "Published", value: stats.publishedProjects },
    { label: "Drafts", value: stats.draftProjects },
    { label: "Featured", value: stats.featuredProjects },
    { label: "Total Images", value: stats.totalImages },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-wide">Dashboard</h1>
          <p className="mt-1 text-sm text-warm-gray">Portfolio overview and quick actions</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-block bg-charcoal px-6 py-3 text-sm uppercase tracking-widest text-cream transition-colors hover:bg-accent"
        >
          New Project
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="border border-stone/60 bg-white p-6">
            <p className="text-xs uppercase tracking-widest text-warm-gray">{card.label}</p>
            <p className="mt-2 font-display text-4xl">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 border border-stone/60 bg-white p-6">
        <h2 className="text-sm uppercase tracking-widest text-warm-gray">Storage</h2>
        <p className="mt-2">
          Provider: <span className="font-medium capitalize">{storage.provider}</span>
          <span className="ml-2 text-sm text-warm-gray">
            {storage.isR2Configured ? "(Cloudflare R2 configured)" : "(R2 environment variables missing)"}
          </span>
        </p>
      </div>
    </div>
  );
}
