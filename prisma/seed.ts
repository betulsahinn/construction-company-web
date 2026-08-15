import { PrismaClient, type Category } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES } from "../src/lib/categories";
import { resolveDatabaseLocation } from "../src/lib/database-url";
import {
  ABOUT_SETTINGS_ID,
  CONTACT_SETTINGS_ID,
  FOOTER_SETTINGS_ID,
  defaultAboutSettings,
  defaultContactSettings,
  defaultFooterSettings,
} from "../src/lib/site-settings";

const databaseLocation = resolveDatabaseLocation();
const prisma = new PrismaClient({ datasourceUrl: databaseLocation.datasourceUrl });
const HERO_BRAND_TITLE = "Mehmet Eser\nInterior Design Studio";

const defaultCategories = DEFAULT_CATEGORIES.map((category, index) => ({
  ...category,
  sortOrder: index,
}));

async function main() {
  if (databaseLocation.filePath) {
    console.log(`Manual seed target: ${databaseLocation.filePath}`);
  }

  const email = process.env.ADMIN_EMAIL ?? "admin@studio.com";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (!existingUser) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Studio Admin",
      },
    });
  }

  const categoryByName = new Map<string, Category>();
  const existingCategories = await prisma.category.findMany({
    where: {
      OR: [
        { slug: { in: defaultCategories.map((category) => category.slug) } },
        { name: { in: defaultCategories.map((category) => category.name) } },
      ],
    },
  });
  const existingCategoryBySlug = new Map(existingCategories.map((category) => [category.slug, category]));
  const existingCategoryByName = new Map(existingCategories.map((category) => [category.name, category]));

  for (const category of defaultCategories) {
    const storedCategory = existingCategoryBySlug.get(category.slug)
      ?? existingCategoryByName.get(category.name)
      ?? await prisma.category.create({ data: category });
    categoryByName.set(category.name, storedCategory);
  }

  const projects = [
    {
      title: "Horizon Residence",
      titleTr: "Horizon Residence",
      titleEn: "Horizon Residence",
      slug: "horizon-residence",
      description:
        "A contemporary cliffside residence that frames the ocean horizon through expansive glazing and raw concrete volumes. The design balances privacy with panoramic views.",
      descriptionTr:
        "Geniş cam yüzeyler ve yalın kütlelerle manzarayı çerçeveleyen çağdaş bir villa tasarımı.",
      descriptionEn:
        "A contemporary cliffside residence that frames the ocean horizon through expansive glazing and raw concrete volumes.",
      location: "Malibu, California",
      year: 2024,
      category: "Lüks Villa",
      categoryNames: ["Lüks Villa", "Cephe Tasarımı"],
      pdfUrl: null,
      featured: true,
      published: true,
      sortOrder: 1,
      images: [
        { url: "/api/uploads/architecture-residence-dusk.png", alt: "Horizon Residence exterior", sortOrder: 0 },
        { url: "/api/uploads/architecture-interior-gallery.png", alt: "Horizon Residence living space", sortOrder: 1 },
        { url: "/api/uploads/architecture-townhouse-evening.png", alt: "Horizon Residence entry facade", sortOrder: 2 },
      ],
    },
    {
      title: "Atrium Gallery",
      titleTr: "Atrium Gallery",
      titleEn: "Atrium Gallery",
      slug: "atrium-gallery",
      description:
        "A cultural pavilion defined by a sculptural timber atrium and diffused natural light. The space hosts rotating exhibitions and community gatherings.",
      descriptionTr:
        "Doğal ışık ve heykelsi ahşap atrium etrafında kurgulanan rafine bir idari yapı sunumu.",
      descriptionEn:
        "A cultural pavilion defined by a sculptural timber atrium and diffused natural light.",
      location: "Copenhagen, Denmark",
      year: 2023,
      category: "İdari Bina",
      categoryNames: ["İdari Bina", "Cephe Tasarımı"],
      pdfUrl: null,
      featured: true,
      published: true,
      sortOrder: 2,
      images: [
        { url: "/api/uploads/architecture-interior-gallery.png", alt: "Atrium Gallery interior", sortOrder: 0 },
        { url: "/api/uploads/architecture-residence-dusk.png", alt: "Atrium Gallery exterior", sortOrder: 1 },
      ],
    },
    {
      title: "Stone & Light Pavilion",
      titleTr: "Stone & Light Pavilion",
      titleEn: "Stone & Light Pavilion",
      slug: "stone-light-pavilion",
      description:
        "An intimate retreat nestled within a limestone quarry, where carved stone walls meet delicate steel and glass interventions.",
      descriptionTr:
        "Taş dokusu, doğal ışık ve sakin detaylarla şekillenen özel bir lüks villa konsepti.",
      descriptionEn:
        "An intimate retreat where carved stone walls meet delicate steel and glass interventions.",
      location: "Tuscany, Italy",
      year: 2022,
      category: "Lüks Villa",
      categoryNames: ["Lüks Villa"],
      pdfUrl: null,
      featured: true,
      published: true,
      sortOrder: 3,
      images: [
        { url: "/api/uploads/architecture-stone-pavilion.png", alt: "Stone pavilion exterior", sortOrder: 0 },
        { url: "/api/uploads/architecture-interior-gallery.png", alt: "Stone pavilion interior", sortOrder: 1 },
      ],
    },
    {
      title: "Urban Loft Conversion",
      titleTr: "Urban Loft Conversion",
      titleEn: "Urban Loft Conversion",
      slug: "urban-loft-conversion",
      description:
        "A warehouse transformation that preserves industrial character while introducing refined material palettes and flexible living zones.",
      descriptionTr:
        "Endüstriyel karakteri korurken cephe ve iç mekan kurgusunu rafine eden dönüşüm projesi.",
      descriptionEn:
        "A warehouse transformation that preserves industrial character with refined material palettes.",
      location: "Brooklyn, New York",
      year: 2024,
      category: "Cephe Tasarımı",
      categoryNames: ["Cephe Tasarımı"],
      pdfUrl: null,
      featured: false,
      published: false,
      sortOrder: 4,
      images: [
        { url: "/api/uploads/architecture-townhouse-evening.png", alt: "Loft exterior entry", sortOrder: 0 },
      ],
    },
  ];

  for (const project of projects) {
    const existingProject = await prisma.project.findUnique({ where: { slug: project.slug } });
    if (existingProject) continue;

    const { images, categoryNames, ...data } = project;
    const projectCategories = categoryNames
      .map((name) => categoryByName.get(name))
      .filter((category): category is NonNullable<typeof category> => Boolean(category));

    await prisma.project.create({
      data: {
        ...data,
        images: {
          create: images,
        },
        categories: {
          create: projectCategories.map((category) => ({
            category: { connect: { id: category.id } },
          })),
        },
      },
    });
  }

  const existingHero = await prisma.homepageHero.findUnique({ where: { id: "homepage" } });
  if (!existingHero) {
    await prisma.homepageHero.create({
      data: {
        id: "homepage",
        title: HERO_BRAND_TITLE,
        subtitle:
          "A quiet study of light, material, and proportion across a contemporary interior architecture portfolio.",
        ctaLabel: null,
        ctaUrl: "/projects",
        mediaType: "image",
        imageUrl: "/api/uploads/architecture-residence-dusk.png",
      },
    });
  }

  const existingAbout = await prisma.aboutPage.findUnique({ where: { id: ABOUT_SETTINGS_ID } });
  if (!existingAbout) {
    await prisma.aboutPage.create({
      data: { id: ABOUT_SETTINGS_ID, ...defaultAboutSettings },
    });
  }

  const existingContact = await prisma.contactPage.findUnique({ where: { id: CONTACT_SETTINGS_ID } });
  if (!existingContact) {
    await prisma.contactPage.create({
      data: { id: CONTACT_SETTINGS_ID, ...defaultContactSettings },
    });
  }

  const existingFooter = await prisma.footerSettings.findUnique({ where: { id: FOOTER_SETTINGS_ID } });
  if (!existingFooter) {
    await prisma.footerSettings.create({
      data: { id: FOOTER_SETTINGS_ID, ...defaultFooterSettings },
    });
  }

  console.log("Database seeded successfully.");
  console.log(`Admin account ensured for ${email}. Existing records were left unchanged.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
