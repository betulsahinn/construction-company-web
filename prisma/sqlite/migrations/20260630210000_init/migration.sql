-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "titleTr" TEXT,
    "titleEn" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "descriptionTr" TEXT,
    "descriptionEn" TEXT,
    "location" TEXT,
    "year" INTEGER,
    "category" TEXT,
    "pdfUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalUrl" TEXT,
    "webUrl" TEXT,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameTr" TEXT,
    "nameEn" TEXT,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectCategory" (
    "projectId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    PRIMARY KEY ("projectId", "categoryId"),
    CONSTRAINT "ProjectCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HomepageHero" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "subtitle" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "imageUrl" TEXT,
    "imageOriginalUrl" TEXT,
    "imageWebUrl" TEXT,
    "imageThumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AboutPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eyebrowTr" TEXT,
    "eyebrowEn" TEXT,
    "titleTr" TEXT,
    "titleEn" TEXT,
    "descriptionTr" TEXT,
    "descriptionEn" TEXT,
    "imageUrl" TEXT,
    "imageOriginalUrl" TEXT,
    "imageWebUrl" TEXT,
    "imageThumbnailUrl" TEXT,
    "imageFileSize" INTEGER,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "imageMimeType" TEXT,
    "approachLabelTr" TEXT,
    "approachLabelEn" TEXT,
    "approachTitleTr" TEXT,
    "approachTitleEn" TEXT,
    "materialTitleTr" TEXT,
    "materialTitleEn" TEXT,
    "materialTextTr" TEXT,
    "materialTextEn" TEXT,
    "proportionTitleTr" TEXT,
    "proportionTitleEn" TEXT,
    "proportionTextTr" TEXT,
    "proportionTextEn" TEXT,
    "narrativeTitleTr" TEXT,
    "narrativeTitleEn" TEXT,
    "narrativeTextTr" TEXT,
    "narrativeTextEn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContactPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT,
    "city" TEXT,
    "address" TEXT,
    "mapsUrl" TEXT,
    "phone" TEXT,
    "instagramUrl" TEXT,
    "instagramHandle" TEXT,
    "titleTr" TEXT,
    "titleEn" TEXT,
    "introTr" TEXT,
    "introEn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FooterSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandTitleTr" TEXT,
    "brandTitleEn" TEXT,
    "descriptionTr" TEXT,
    "descriptionEn" TEXT,
    "businessName" TEXT,
    "city" TEXT,
    "address" TEXT,
    "mapsUrl" TEXT,
    "phone" TEXT,
    "instagramUrl" TEXT,
    "instagramHandle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "logoOriginalUrl" TEXT,
    "logoWebUrl" TEXT,
    "logoThumbnailUrl" TEXT,
    "logoFileSize" INTEGER,
    "logoWidth" INTEGER,
    "logoHeight" INTEGER,
    "logoMimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionEn" TEXT NOT NULL,
    "answerEn" TEXT NOT NULL,
    "questionTr" TEXT NOT NULL,
    "answerTr" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
