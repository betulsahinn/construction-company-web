"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND_NAME, toLanguageUppercase, translations, type Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/use-language";
import { getLocalizedFooter, getPhoneHref, type FooterSettingsView } from "@/lib/site-settings";

const STUDIO_EMAIL = "info@icmimarmehmeteser.com";

export function Footer({
  initialLanguage,
  footerSettings,
}: {
  initialLanguage: Language;
  footerSettings: FooterSettingsView;
}) {
  const { language } = useLanguagePreference(initialLanguage);
  const t = translations[language];
  const footer = getLocalizedFooter(footerSettings, language);
  const phoneHref = getPhoneHref(footerSettings.phone);
  const currentYear = new Date().getFullYear();

  return (
    <footer lang={language} className="bg-charcoal px-6 pb-6 pt-24 text-cream md:px-10 md:pt-28">
      <div className="studio-container">
        <div className="grid gap-14 border-b border-cream/10 pb-24 md:grid-cols-3">
          <div>
            <p className="font-display text-[1.7rem] leading-none tracking-[0.03em]">
              {footer.brandTitle}
            </p>
            <p className="mt-7 max-w-[280px] text-sm leading-7 text-stone/75">
              {footer.description}
            </p>
          </div>

          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.36em] text-accent">
              {toLanguageUppercase(t.nav.navigation, language)}
            </p>
            <nav className="mt-7 flex flex-col gap-4 text-sm text-stone/80">
              <Link href="/projects" className="transition-colors hover:text-accent">
                {t.nav.projects}
              </Link>
              <Link href="/about" className="transition-colors hover:text-accent">
                {t.nav.about}
              </Link>
              <Link href="/references" className="transition-colors hover:text-accent">
                {t.nav.references}
              </Link>
              <Link href="/faq" className="transition-colors hover:text-accent">
                {t.nav.faq}
              </Link>
              <Link href="/contact" className="transition-colors hover:text-accent">
                {t.nav.contact}
              </Link>
            </nav>
          </div>

          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.36em] text-accent">
              {toLanguageUppercase(t.nav.contact, language)}
            </p>
            <div className="mt-7 space-y-4 text-sm leading-6 text-stone/80">
              <FooterContactLink href={footerSettings.mapsUrl} icon="location">
                {footerSettings.address}
              </FooterContactLink>
              <FooterContactLink href={phoneHref} icon="phone">
                {footerSettings.phone}
              </FooterContactLink>
              <FooterContactLink href={footerSettings.instagramUrl} icon="instagram" external>
                {footerSettings.instagramHandle || "Instagram"}
              </FooterContactLink>
              <FooterContactLink href={`mailto:${STUDIO_EMAIL}`} icon="email">
                {STUDIO_EMAIL}
              </FooterContactLink>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center px-4 py-10 text-center md:py-12">
          <p className="text-[0.68rem] leading-5 text-stone/60">
            © {currentYear} {BRAND_NAME}. {t.footer.rightsReserved}
          </p>
          <a
            href="https://wa.me/905312486870"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-stone/50 transition-colors hover:text-accent"
          >
            BŞ YAZILIM
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterContactLink({
  href,
  icon,
  children,
  external = false,
}: {
  href: string;
  icon: "location" | "phone" | "instagram" | "email";
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external || href.startsWith("http") ? "_blank" : undefined}
      rel={external || href.startsWith("http") ? "noreferrer" : undefined}
      className="group flex items-start gap-3 transition-colors hover:text-accent"
    >
      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center text-accent/80 transition-colors group-hover:text-accent">
        <FooterIcon type={icon} />
      </span>
      <span>{children}</span>
    </a>
  );
}

function FooterIcon({ type }: { type: "location" | "phone" | "instagram" | "email" }) {
  if (type === "location") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M12 21s6-5.1 6-11a6 6 0 0 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  if (type === "phone") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M7.2 4.8 9.4 4l2.1 5-1.7 1.1a10.4 10.4 0 0 0 4.1 4.1l1.1-1.7 5 2.1-.8 2.2c-.3.8-1 1.3-1.9 1.2A13.6 13.6 0 0 1 6 6.7c-.1-.9.4-1.6 1.2-1.9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "email") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.4 11.6a3.4 3.4 0 1 1-6.8.8 3.4 3.4 0 0 1 6.8-.8Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16.6 7.8h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
