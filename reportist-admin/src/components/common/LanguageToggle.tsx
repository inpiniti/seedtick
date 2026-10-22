import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LanguageToggleProps {
  className?: string;
}

export function LanguageToggle({ className = "" }: LanguageToggleProps) {
  const { isEn, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-card p-0.5 text-xs shadow-xs transition-colors ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLanguage("ko")}
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
        onClick={() => setLanguage("en")}
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
