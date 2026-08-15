"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, type Language, normalizeLanguage } from "./i18n";

const LANGUAGE_STORAGE_KEY = "site-language";
const LANGUAGE_CHANGE_EVENT = "site-language-change";

function parseLanguagePreference(value?: string | null): Language | null {
  return value === "tr" || value === "en" ? value : null;
}

function readLanguageCookie() {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${LANGUAGE_COOKIE}=`));

  return parseLanguagePreference(match?.split("=")[1]);
}

function readStoredLanguage() {
  if (typeof window === "undefined") return null;
  return parseLanguagePreference(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

export function useLanguagePreference(initialLanguage: Language = DEFAULT_LANGUAGE) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    const cookieLanguage = readLanguageCookie();
    const storedLanguage = readStoredLanguage();
    // localStorage survives cookie clearing and is written only after an
    // explicit switch, so it is the strongest client-side preference.
    const nextLanguage = normalizeLanguage(storedLanguage ?? cookieLanguage ?? DEFAULT_LANGUAGE);

    setLanguageState(nextLanguage);

    if (cookieLanguage !== storedLanguage) {
      document.cookie = `${LANGUAGE_COOKIE}=${nextLanguage}; path=/; max-age=31536000; SameSite=Lax`;
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    }

    if (nextLanguage !== initialLanguage) {
      router.refresh();
    }
  }, [initialLanguage, router]);

  useEffect(() => {
    function syncLanguage(event: Event) {
      const nextLanguage = (event as CustomEvent<Language>).detail;
      setLanguageState(normalizeLanguage(nextLanguage));
    }

    window.addEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
    return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, syncLanguage);
  }, []);

  function setLanguage(nextLanguage: Language) {
    document.cookie = `${LANGUAGE_COOKIE}=${nextLanguage}; path=/; max-age=31536000; SameSite=Lax`;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
    window.dispatchEvent(new CustomEvent<Language>(LANGUAGE_CHANGE_EVENT, { detail: nextLanguage }));
    router.refresh();
  }

  return { language, setLanguage };
}
