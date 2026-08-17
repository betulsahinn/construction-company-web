-- Add editable public contact email settings.
ALTER TABLE "ContactPage" ADD COLUMN "email" TEXT;
ALTER TABLE "FooterSettings" ADD COLUMN "email" TEXT;
