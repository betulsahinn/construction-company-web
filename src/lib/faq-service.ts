import { prisma } from "@/lib/prisma";

export type FaqRecord = {
  id: string;
  questionEn: string;
  answerEn: string;
  questionTr: string;
  answerTr: string;
  sortOrder: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function listFaqs(publishedOnly = false): Promise<FaqRecord[]> {
  return prisma.faq.findMany({
    where: publishedOnly ? { published: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getFaq(id: string): Promise<FaqRecord | null> {
  return prisma.faq.findUnique({ where: { id } });
}

export async function createFaq(data: Omit<FaqRecord, "id" | "createdAt" | "updatedAt">): Promise<FaqRecord> {
  return prisma.faq.create({ data });
}

export async function updateFaq(
  id: string,
  data: Omit<FaqRecord, "id" | "createdAt" | "updatedAt">,
): Promise<FaqRecord | null> {
  const result = await prisma.faq.updateMany({ where: { id }, data });
  return result.count ? getFaq(id) : null;
}

export async function deleteFaq(id: string): Promise<boolean> {
  const result = await prisma.faq.deleteMany({ where: { id } });
  return result.count > 0;
}

export async function reorderFaqs(updates: Array<{ id: string; sortOrder: number }>): Promise<void> {
  await prisma.$transaction(
    updates.map(({ id, sortOrder }) => prisma.faq.update({
      where: { id },
      data: { sortOrder },
    })),
  );
}
