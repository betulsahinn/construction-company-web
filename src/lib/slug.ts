import slugify from "slugify";
import { prisma } from "./prisma";

const turkishCharacterMap: Record<string, string> = {
  "\u0131": "i",
  "\u0130": "i",
  "\u015F": "s",
  "\u015E": "s",
  "\u00E7": "c",
  "\u00C7": "c",
  "\u011F": "g",
  "\u011E": "g",
  "\u00FC": "u",
  "\u00DC": "u",
  "\u00F6": "o",
  "\u00D6": "o",
};

export function createSlug(value: string) {
  const normalized = value
    .replace(/[\u0131\u0130\u015F\u015E\u00E7\u00C7\u011F\u011E\u00FC\u00DC\u00F6\u00D6]/g, (char) => turkishCharacterMap[char] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return slugify(normalized, { lower: true, strict: true }) || "project";
}

export async function ensureUniqueSlug(baseSlug: string, excludeId?: string) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await prisma.project.findFirst({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
