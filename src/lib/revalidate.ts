import { revalidatePath } from "next/cache";

export function revalidateStudioContent(paths: string[] = []) {
  const basePaths = [
    "/",
    "/projects",
    "/references",
    "/faq",
    "/about",
    "/contact",
    "/admin",
    "/admin/projects",
    "/admin/categories",
    "/admin/homepage",
    "/admin/about",
    "/admin/contact",
    "/admin/footer",
    "/admin/references",
    "/admin/faqs",
  ];

  for (const path of [...basePaths, ...paths]) {
    revalidatePath(path);
  }

  revalidatePath("/projects/[slug]", "page");
  revalidatePath("/admin/projects/[id]/edit", "page");
}
