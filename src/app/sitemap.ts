import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const publicRoutes = [
  { path: "/", priority: 1 },
  { path: "/projects", priority: 0.9 },
  { path: "/about", priority: 0.7 },
  { path: "/references", priority: 0.6 },
  { path: "/faq", priority: 0.5 },
  { path: "/contact", priority: 0.7 },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const projects = await prisma.project.findMany({
    where: { published: true },
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });

  return [
    ...publicRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.path === "/" || route.path === "/projects" ? ("weekly" as const) : ("monthly" as const),
      priority: route.priority,
    })),
    ...projects.map((project) => ({
      url: absoluteUrl(`/projects/${project.slug}`),
      lastModified: project.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
