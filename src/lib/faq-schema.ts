import { z } from "zod";

export const faqSchema = z.object({
  questionEn: z.string().trim().min(1),
  answerEn: z.string().trim().min(1),
  questionTr: z.string().trim().min(1),
  answerTr: z.string().trim().min(1),
  sortOrder: z.number().int(),
  published: z.boolean(),
});
