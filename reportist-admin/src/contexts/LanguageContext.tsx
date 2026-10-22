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

    // 2. 브라우저의 실제 현재 전체 URL(SPA pushState 경로 + 쿼리 파라미터 + 해시) 추출
    //    usePathname()은 React 상태이므로 window.history.pushState로 변경된 상세 주소를
    //    알지 못해 홈(/)으로 튕기는 현상을 완벽히 방지합니다.
    let currentPath = pathname;
    let currentSearch = "";
    let currentHash = "";

    if (typeof window !== "undefined") {
      currentPath = window.location.pathname || pathname;
      currentSearch = window.location.search || "";
      currentHash = window.location.hash || "";
    }

    // 3. 현재 위치를 정확히 보존하며 언어 프리픽스(/en <-> /)만 치환
    let targetBasePath = currentPath;
    if (targetLang === "en") {
      targetBasePath = currentPath.startsWith("/en")
        ? currentPath
        : currentPath === "/"
        ? "/en"
        : `/en${currentPath}`;
    } else {
      // targetLang === "ko"
      targetBasePath = currentPath.startsWith("/en")
        ? currentPath.replace(/^\/en(\/|$)/, "$1") || "/"
        : currentPath;
    }

    const newTargetUrl = `${targetBasePath}${currentSearch}${currentHash}`;

    // 4. 스크롤 위치를 유지하며 현재 페이지에서 언어만 전환 ({ scroll: false })
    if (typeof window !== "undefined") {
      const fullCurrentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (fullCurrentUrl !== newTargetUrl) {
        router.push(newTargetUrl, { scroll: false });
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
