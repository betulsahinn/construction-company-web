import { AboutSettingsForm } from "@/components/admin/AboutSettingsForm";
import { prisma } from "@/lib/prisma";
import { ABOUT_SETTINGS_ID, resolveAboutSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

async function getAboutSettings() {
  const settings = await prisma.aboutPage.findUnique({ where: { id: ABOUT_SETTINGS_ID } });
  return resolveAboutSettings(settings);
}

export default async function AdminAboutPage() {
  const settings = await getAboutSettings();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-wide">About Page</h1>
        <p className="mt-1 text-sm text-warm-gray">Manage multilingual company copy, image, and approach content.</p>
      </div>
      <AboutSettingsForm initialData={settings} />
    </div>
  );
}
