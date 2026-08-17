"use client";

import { SmartImage } from "@/components/SmartImage";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toLanguageUppercase, translations, type Language } from "@/lib/i18n";
import { useLanguagePreference } from "@/lib/use-language";

const navLinks = [
  { href: "/", labelKey: "home" },
  { href: "/projects", labelKey: "projects" },
  { href: "/about", labelKey: "about" },
  { href: "/contact", labelKey: "contact" },
] as const;

export function Header({ initialLanguage }: { initialLanguage: Language }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const { language, setLanguage } = useLanguagePreference(initialLanguage);
  const t = translations[language];
  const isHome = pathname === "/";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const passiveCaptureOptions = { capture: true, passive: true } as const;

    function closeMobileMenu() {
      setMobileOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (headerRef.current?.contains(target)) return;

      closeMobileMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === "touch" || event.pointerType === "pen") {
        closeMobileMenu();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove, passiveCaptureOptions);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", closeMobileMenu, passiveCaptureOptions);
    document.addEventListener("wheel", closeMobileMenu, passiveCaptureOptions);
    document.addEventListener("touchmove", closeMobileMenu, passiveCaptureOptions);
    window.addEventListener("scroll", closeMobileMenu, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove, passiveCaptureOptions);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", closeMobileMenu, passiveCaptureOptions);
      document.removeEventListener("wheel", closeMobileMenu, passiveCaptureOptions);
      document.removeEventListener("touchmove", closeMobileMenu, passiveCaptureOptions);
      window.removeEventListener("scroll", closeMobileMenu);
    };
  }, [mobileOpen]);

  return (
    <header
      ref={headerRef}
      lang={language}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-500",
        isHome ? "bg-transparent text-cream" : "border-b border-stone/80 bg-cream text-charcoal",
      )}
    >
      <div className="studio-container flex h-[82px] items-center justify-between px-6 md:px-0">
        <Link
          href="/"
          aria-label="Turkuvaz İnşaat homepage"
          onClick={() => setMobileOpen(false)}
          className="block shrink-0 leading-none"
        >
          <SmartImage
            src="/api/uploads/logo1.png"
            alt="Turkuvaz İnşaat"
            width={800}
            height={200}
            loading="eager"
            fetchPriority="auto"
            className="h-16 w-auto object-contain md:h-20"
            sizes="(max-width: 768px) 192px, 224px"
          />
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-[0.68rem] font-semibold uppercase tracking-[0.38em] transition-colors",
                isHome ? "text-cream/80 hover:text-accent" : "text-charcoal hover:text-accent",
              )}
            >
              {toLanguageUppercase(t.nav[link.labelKey], language)}
            </Link>
          ))}
          <LanguageSwitcher language={language} onChange={setLanguage} isHome={isHome} />
        </nav>

        <button
          type="button"
          className={cn(
            "flex h-10 w-10 flex-col items-center justify-center gap-1.5 border md:hidden",
            isHome ? "border-cream/40" : "border-stone",
          )}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className={cn("block h-px w-6 transition-transform", isHome ? "bg-cream" : "bg-charcoal", mobileOpen && "translate-y-2 rotate-45")} />
          <span className={cn("block h-px w-6 transition-opacity", isHome ? "bg-cream" : "bg-charcoal", mobileOpen && "opacity-0")} />
          <span className={cn("block h-px w-6 transition-transform", isHome ? "bg-cream" : "bg-charcoal", mobileOpen && "-translate-y-2 -rotate-45")} />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-y border-stone/70 bg-cream text-charcoal md:hidden"
          >
            <div className="flex flex-col gap-5 px-6 py-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.32em] transition-colors",
                    "text-charcoal hover:text-accent",
                  )}
                >
                  {toLanguageUppercase(t.nav[link.labelKey], language)}
                </Link>
              ))}
              <LanguageSwitcher language={language} onChange={setLanguage} isHome={false} />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function LanguageSwitcher({
  language,
  onChange,
  isHome,
}: {
  language: Language;
  onChange: (language: Language) => void;
  isHome: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {(["en", "tr"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "text-[0.68rem] font-semibold uppercase tracking-[0.24em] transition-colors",
            language === option
              ? "text-accent"
              : isHome
                ? "text-cream/70 hover:text-accent"
                : "text-warm-gray hover:text-charcoal",
          )}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
