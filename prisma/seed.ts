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
const HERO_BRAND_TITLE = "Turkuvaz İnşaat";
const DEFAULT_HERO_IMAGE = "/api/uploads/ai-son.png";

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
      title: "Turkuvaz Villaları",
      titleTr: "Turkuvaz Villaları",
      titleEn: "Turkuvaz Villas",
      slug: "turkuvaz-villalari",
      description: null,
      descriptionTr: null,
      descriptionEn: null,
      location: null,
      year: null,
      category: "Residential",
      categoryNames: ["Residential"],
      pdfUrl: null,
      featured: false,
      published: true,
      sortOrder: 1,
      images: [],
    },
    {
      title: "Bağlarbaşı Kooperatif",
      titleTr: "Bağlarbaşı Kooperatif",
      titleEn: "Bağlarbaşı Cooperative",
      slug: "baglarbasi-kooperatif",
      description: null,
      descriptionTr: null,
      descriptionEn: null,
      location: null,
      year: null,
      category: "Cooperative",
      categoryNames: ["Cooperative"],
      pdfUrl: null,
      featured: false,
      published: true,
      sortOrder: 2,
      images: [],
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
          "A professional construction approach focused on planned, careful, and reliable project execution.",
        ctaLabel: null,
        ctaUrl: "/projects",
        mediaType: "image",
        imageUrl: DEFAULT_HERO_IMAGE,
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
