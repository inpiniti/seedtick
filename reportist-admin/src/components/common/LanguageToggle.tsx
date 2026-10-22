import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className = "" }: LanguageToggleProps) {
  const { isEn, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-[#cbd5e1] bg-[#f1f5f9] p-0.5 text-xs font-mono shadow-2xs ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLanguage("ko")}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-bold text-xs transition-all cursor-pointer ${
          !isEn
            ? "bg-[#0f172a] text-white shadow-xs"
            : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200/60"
        }`}
        aria-pressed={!isEn}
      >
        <span>KO</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-bold text-xs transition-all cursor-pointer ${
          isEn
            ? "bg-[#0f172a] text-white shadow-xs"
            : "text-[#64748b] hover:text-[#0f172a] hover:bg-slate-200/60"
        }`}
        aria-pressed={isEn}
      >
        <Globe className={`h-3.5 w-3.5 ${isEn ? "text-white" : "text-[#94a3b8]"}`} />
        <span>EN</span>
      </button>
    </div>
  );
}
