import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKRW(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "0원";
  return `${val.toLocaleString("ko-KR")}원`;
}

export function formatUSD(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "$0.00";
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPriceByNation(
  val?: number | null,
  nation?: string,
  ticker?: string
): string {
  if (val === undefined || val === null || isNaN(val)) return "-";
  const isKr = nation?.toLowerCase() === "kr" || (ticker ? /^\d{6}/.test(ticker) : false);
  if (isKr) {
    return formatKRW(val);
  }
  return formatUSD(val);
}

export function formatMarketCap(val?: number | null, nation?: string, ticker?: string): string {
  if (val === undefined || val === null || isNaN(val)) return "-";
  const isKr = nation?.toLowerCase() === "kr" || (ticker ? /^\d{6}/.test(ticker) : false) || val > 500_000_000_000;
  if (isKr) {
    const jo = 1_000_000_000_000;
    const eog = 100_000_000;
    if (val >= jo) {
      const joVal = Math.floor(val / jo);
      const eogVal = Math.round((val % jo) / eog);
      return eogVal > 0 ? `${joVal}조 ${eogVal.toLocaleString("ko-KR")}억` : `${joVal}조원`;
    }
    if (val >= eog) {
      return `${Math.round(val / eog).toLocaleString("ko-KR")}억원`;
    }
    return `${val.toLocaleString("ko-KR")}원`;
  }
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString("en-US")}`;
}

export function formatPercent(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "0.0%";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

export function formatTime(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function getScoreBadge(score?: number | null): {
  label: string;
  bg: string;
  text: string;
} {
  switch (score) {
    case 0:
      return { label: "강력 매수", bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700" };
    case 1:
      return { label: "보유", bg: "bg-slate-50 border border-slate-200", text: "text-slate-700" };
    case 2:
      return { label: "관망", bg: "bg-amber-50 border border-amber-200", text: "text-amber-700" };
    case 3:
      return { label: "매도/비추천", bg: "bg-rose-50 border border-rose-200", text: "text-rose-700" };
    default:
      return { label: "미평가", bg: "bg-slate-50 border border-slate-200", text: "text-slate-500" };
  }
}
