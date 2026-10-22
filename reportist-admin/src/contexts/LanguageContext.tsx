"use client";

import React, { createContext, useContext, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Locale, Dictionary, getDictionary } from "@/dictionaries/i18n";

interface LanguageContextValue {
  lang: Locale;
  isEn: boolean;
  dict: Dictionary;
  setLanguage: (lang: Locale) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  forcedLang,
}: {
  children: React.ReactNode;
  forcedLang?: Locale;
}) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  // pathname이 /en 또는 /en/... 으로 시작하면 'en', 그 외에는 'ko'
  const detectedLang: Locale = useMemo(() => {
    if (forcedLang) return forcedLang;
    return pathname.startsWith("/en") ? "en" : "ko";
  }, [pathname, forcedLang]);

  const dict = useMemo(() => getDictionary(detectedLang), [detectedLang]);

  const setLanguage = (targetLang: Locale) => {
    if (targetLang === "en" && !pathname.startsWith("/en")) {
      const newPath = pathname === "/" ? "/en" : `/en${pathname}`;
      router.push(newPath);
    } else if (targetLang === "ko" && pathname.startsWith("/en")) {
      const newPath = pathname.replace(/^\/en(\/|$)/, "$1") || "/";
      router.push(newPath);
    }
  };

  const toggleLanguage = () => {
    setLanguage(detectedLang === "en" ? "ko" : "en");
  };

  const value = useMemo(
    () => ({
      lang: detectedLang,
      isEn: detectedLang === "en",
      dict,
      setLanguage,
      toggleLanguage,
    }),
    [detectedLang, dict]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Context 외부에서 호출 시 기본 ko fallback
    return {
      lang: "ko",
      isEn: false,
      dict: getDictionary("ko"),
      setLanguage: () => {},
      toggleLanguage: () => {},
    };
  }
  return context;
}
