import { ContactSettingsForm } from "@/components/admin/ContactSettingsForm";
import { prisma } from "@/lib/prisma";
import { CONTACT_SETTINGS_ID, resolveContactSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

async function getContactSettings() {
  const settings = await prisma.contactPage.findUnique({ where: { id: CONTACT_SETTINGS_ID } });
  return resolveContactSettings(settings);
}

export default async function AdminContactPage() {
  const settings = await getContactSettings();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl tracking-wide">Contact Page</h1>
        <p className="mt-1 text-sm text-warm-gray">Manage public contact details, footer contact information, and multilingual intro copy.</p>
      </div>
      <ContactSettingsForm initialData={settings} />
    </div>
  );
}
