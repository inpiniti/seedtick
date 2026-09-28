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
      return { label: "강력 매수", bg: "bg-[#fef0f1]", text: "text-[#f04452]" };
    case 1:
      return { label: "보유", bg: "bg-[#e8f3ff]", text: "text-[#3182f6]" };
    case 2:
      return { label: "관망", bg: "bg-[#fff5e6]", text: "text-[#ff9500]" };
    case 3:
      return { label: "매도/비추천", bg: "bg-[#e6f8f0]", text: "text-[#03b26c]" };
    default:
      return { label: "미평가", bg: "bg-[#f2f4f6]", text: "text-[#8b95a1]" };
  }
}
