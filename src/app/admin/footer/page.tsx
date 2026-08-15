import { FooterSettingsForm } from "@/components/admin/FooterSettingsForm";
import { prisma } from "@/lib/prisma";
import {
  CONTACT_SETTINGS_ID,
  FOOTER_SETTINGS_ID,
  resolveContactSettings,
  resolveFooterSettings,
} from "@/lib/site-settings";

export const dynamic = "force-dynamic";

async function getFooterSettings() {
  const [footer, contact] = await Promise.all([
    prisma.footerSettings.findUnique({ where: { id: FOOTER_SETTINGS_ID } }),
    prisma.contactPage.findUnique({ where: { id: CONTACT_SETTINGS_ID } }),
  ]);

  return resolveFooterSettings(footer, resolveContactSettings(contact));
}

export default async function AdminFooterPage() {
  const settings = await getFooterSettings();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-wide">Footer</h1>
        <p className="mt-1 text-sm text-warm-gray">Manage multilingual footer copy and footer contact details.</p>
      </div>
      <FooterSettingsForm initialData={settings} />
    </div>
  );
}
