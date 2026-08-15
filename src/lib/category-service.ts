import { prisma } from "./prisma";

export async function getOrderedCategories() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
