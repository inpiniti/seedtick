"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface TallyCounts {
  buy: number;
  hold: number;
  watch: number;
  sell: number;
}

export interface TallyBarProps {
  tally: TallyCounts;
  className?: string;
  showLabels?: boolean;
  size?: "sm" | "md";
}

export function TallyBar({
  tally,
  className,
  showLabels = true,
  size = "md",
}: TallyBarProps) {
  const total = tally.buy + tally.hold + tally.watch + tally.sell;
  if (total === 0) return null;

  const buyPct = (tally.buy / total) * 100;
  const holdPct = (tally.hold / total) * 100;
  const watchPct = (tally.watch / total) * 100;
  const sellPct = (tally.sell / total) * 100;

  const barHeight = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div className={cn("space-y-1.5 font-mono", className)}>
      {/* 가로 프로포셔널 바 */}
      <div
        className={cn(
          "w-full flex rounded-full overflow-hidden bg-[#f1f5f9] border border-[#e2e8f0]",
          barHeight
        )}
      >
        {tally.buy > 0 && (
          <div
            className="bg-[#0f172a] transition-all"
            style={{ width: `${buyPct}%` }}
            title={`매수: ${tally.buy}표 (${buyPct.toFixed(0)}%)`}
          />
        )}
        {tally.hold > 0 && (
          <div
            className="bg-[#475569] transition-all"
            style={{ width: `${holdPct}%` }}
            title={`보유: ${tally.hold}표 (${holdPct.toFixed(0)}%)`}
          />
        )}
        {tally.watch > 0 && (
          <div
            className="bg-[#94a3b8] transition-all"
            style={{ width: `${watchPct}%` }}
            title={`관망: ${tally.watch}표 (${watchPct.toFixed(0)}%)`}
          />
        )}
        {tally.sell > 0 && (
          <div
            className="bg-white border-l border-[#64748b] transition-all"
            style={{ width: `${sellPct}%` }}
            title={`매도: ${tally.sell}표 (${sellPct.toFixed(0)}%)`}
          />
        )}
      </div>

      {/* 범례 및 표 수 레이블 */}
      {showLabels && (
        <div className="flex items-center gap-3 text-[11px] text-[#64748b] flex-wrap">
          {tally.buy > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-[#0f172a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f172a]" />
              매수 {tally.buy}
            </span>
          )}
          {tally.hold > 0 && (
            <span className="inline-flex items-center gap-1 text-[#334155]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#475569]" />
              보유 {tally.hold}
            </span>
          )}
          {tally.watch > 0 && (
            <span className="inline-flex items-center gap-1 text-[#64748b]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />
              관망 {tally.watch}
            </span>
          )}
          {tally.sell > 0 && (
            <span className="inline-flex items-center gap-1 text-[#475569]">
              <span className="w-1.5 h-1.5 rounded-full bg-white border border-[#475569]" />
              매도 {tally.sell}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
