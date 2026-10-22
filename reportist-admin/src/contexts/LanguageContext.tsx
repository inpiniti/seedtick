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

  // 사용자 수동 토글 시 즉시 UI 반영을 위한 로컬 상태
  const [overrideLang, setOverrideLang] = React.useState<Locale | null>(null);

  // pathname이 변경되면 수동 오버라이드를 해제하고 URL 기반 언어로 자연 동기화
  React.useEffect(() => {
    setOverrideLang(null);
  }, [pathname]);

  // pathname이 /en 또는 /en/... 으로 시작하면 'en', 그 외에는 'ko'
  const routeLang: Locale = React.useMemo(() => {
    if (forcedLang) return forcedLang;
    return pathname.startsWith("/en") ? "en" : "ko";
  }, [pathname, forcedLang]);

  const activeLang: Locale = overrideLang ?? routeLang;
  const dict = useMemo(() => getDictionary(activeLang), [activeLang]);

  const setLanguage = (targetLang: Locale) => {
    // 1. 토글 버튼 및 UI 즉각 반응 (0초 피드백)
    setOverrideLang(targetLang);

    // 2. 이동할 목적지 URL 계산
    let newPath = pathname;
    if (targetLang === "en") {
      newPath = pathname.startsWith("/en")
        ? pathname
        : pathname === "/"
        ? "/en"
        : `/en${pathname}`;
    } else {
      // targetLang === "ko"
      newPath = pathname.startsWith("/en")
        ? pathname.replace(/^\/en(\/|$)/, "$1") || "/"
        : pathname;
    }

    // 3. 브라우저 경로 이동
    if (typeof window !== "undefined") {
      if (window.location.pathname !== newPath) {
        router.push(newPath);
      } else {
        router.refresh();
      }
    }
  };

  const toggleLanguage = () => {
    setLanguage(activeLang === "en" ? "ko" : "en");
  };

  const value = useMemo(
    () => ({
      lang: activeLang,
      isEn: activeLang === "en",
      dict,
      setLanguage,
      toggleLanguage,
    }),
    [activeLang, dict]
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
