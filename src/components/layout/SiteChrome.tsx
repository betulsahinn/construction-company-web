"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import type { Language } from "@/lib/i18n";
import type { FooterSettingsView } from "@/lib/site-settings";

export function SiteChrome({
  children,
  initialLanguage,
  footerSettings,
}: {
  children: ReactNode;
  initialLanguage: Language;
  footerSettings: FooterSettingsView;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <>
      <Header initialLanguage={initialLanguage} />
      <main>{children}</main>
      {!isHome && <Footer initialLanguage={initialLanguage} footerSettings={footerSettings} />}
    </>
  );
}
