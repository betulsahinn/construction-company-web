import { SiteChrome } from "@/components/layout/SiteChrome";
import { getServerLanguage } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";
import {
  CONTACT_SETTINGS_ID,
  FOOTER_SETTINGS_ID,
  resolveContactSettings,
  resolveFooterSettings,
} from "@/lib/site-settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [language, contactRecord, footerRecord] = await Promise.all([
    getServerLanguage(),
    prisma.contactPage.findUnique({ where: { id: CONTACT_SETTINGS_ID } }),
    prisma.footerSettings.findUnique({ where: { id: FOOTER_SETTINGS_ID } }),
  ]);
  const contactSettings = resolveContactSettings(contactRecord);
  const footerSettings = resolveFooterSettings(footerRecord, contactSettings);

  return (
    <SiteChrome initialLanguage={language} footerSettings={footerSettings}>
      {children}
    </SiteChrome>
  );
}
