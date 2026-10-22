"use client";

import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className = "" }: LanguageToggleProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  const isEn = pathname.startsWith("/en");

  const toggleLanguage = (targetLang: "ko" | "en") => {
    if (targetLang === "en" && !isEn) {
      // 한국어 -> 영어: 경로 앞에 /en 접두사 추가
      const newPath = pathname === "/" ? "/en" : `/en${pathname}`;
      router.push(newPath);
    } else if (targetLang === "ko" && isEn) {
      // 영어 -> 한국어: 경로 앞의 /en 접두사 제거
      const newPath = pathname.replace(/^\/en(\/|$)/, "$1") || "/";
      router.push(newPath);
    }
  };

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-card p-0.5 text-xs shadow-xs transition-colors ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => toggleLanguage("ko")}
        className={`flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-all ${
          !isEn
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={!isEn}
      >
        <span>KO</span>
      </button>
      <button
        type="button"
        onClick={() => toggleLanguage("en")}
        className={`flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-all ${
          isEn
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={isEn}
      >
        <Globe className="h-3 w-3" />
        <span>EN</span>
      </button>
    </div>
  );
}
