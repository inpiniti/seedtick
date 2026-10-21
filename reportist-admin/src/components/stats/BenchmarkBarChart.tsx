"use client";

import React, { useState } from "react";
import { GuruReportRow } from "@/types/api";
import { ExternalLink, Sparkles, ChevronRight } from "lucide-react";

export interface BenchmarkChartItem {
  ticker: string;
  name: string;
  value: number;
  displayValue: string;
  report: GuruReportRow;
  color?: string;
  subText?: string;
}

interface BenchmarkBarChartProps {
  title: string;
  subtitle: string;
  badge?: string;
  items: BenchmarkChartItem[];
  onSelectReport: (report: GuruReportRow) => void;
  logoMap?: Record<string, string>;
  unit?: string;
}

// Artificial Analysis 스타일 프리미엄 컬러 팔레트
const PALETTE = [
  "#2563eb", // Blue
  "#059669", // Emerald
  "#7c3aed", // Violet
  "#0891b2", // Cyan
  "#ea580c", // Orange
  "#4f46e5", // Indigo
  "#0284c7", // Sky
  "#16a34a", // Green
  "#9333ea", // Purple
  "#d97706", // Amber
  "#0d9488", // Teal
  "#e11d48", // Rose
  "#3b82f6", // Light Blue
  "#10b981", // Light Emerald
  "#6366f1", // Light Indigo
  "#f97316", // Coral
  "#14b8a6", // Light Teal
  "#8b5cf6", // Light Purple
];

export function BenchmarkBarChart({
  title,
  subtitle,
  badge,
  items,
  onSelectReport,
  logoMap = {},
}: BenchmarkBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!items || items.length === 0) {
    return (
      <div className="p-6 rounded-md border border-[#e2e8f0] bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-[#0f172a]">{title}</h3>
        </div>
        <p className="text-xs text-[#94a3b8]">해당 기준의 분석 종목 데이터가 없습니다.</p>
      </div>
    );
  }

  // 최댓값 기준으로 막대 높이 정규화 (최소 0 이상)
  const maxValue = Math.max(...items.map((it) => it.value), 1);
  const chartHeight = 150; // 막대그래프 높이 (px)
  const hoveredItem = hoveredIndex !== null ? items[hoveredIndex] : null;

  return (
    <div className="p-5 sm:p-6 rounded-md border border-[#e2e8f0] bg-white shadow-2xs hover:border-[#cbd5e1] transition-all flex flex-col justify-between">
      {/* ── 카드 상단 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
              {title}
            </h3>
            {badge && (
              <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                {badge}
              </span>
            )}
            <ExternalLink className="w-3.5 h-3.5 text-[#94a3b8]" />
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">
            {subtitle}
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-1 text-[10px] font-mono text-[#94a3b8] font-medium">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          <span>Reportist Benchmark</span>
        </div>
      </div>

      {/* ── [핵심 개선] 상단 라이브 인스펙터 바: 툴팁 잘림 100% 방지 ── */}
      <div className="min-h-[38px] mb-3">
        {hoveredItem ? (
          <div
            onClick={() => onSelectReport(hoveredItem.report)}
            className="w-full px-3 py-2 rounded bg-[#0f172a] text-white flex flex-wrap items-center justify-between gap-2 text-xs font-mono cursor-pointer hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-white text-sm truncate">
                {hoveredItem.name}
              </span>
              <span className="text-slate-400">({hoveredItem.ticker})</span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-emerald-400 font-bold text-sm">
                {hoveredItem.displayValue}
              </span>
              {hoveredItem.subText && (
                <span className="text-slate-300 text-[11px] hidden md:inline">
                  {hoveredItem.subText}
                </span>
              )}
              <span className="text-blue-300 text-[11px] flex items-center gap-0.5">
                심층 리포트 보기 <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full px-3 py-2 rounded bg-[#f8fafc] border border-dashed border-[#e2e8f0] text-xs font-mono text-[#94a3b8] flex items-center justify-between">
            <span>막대에 마우스를 올리면 종목명, 정확한 수치, 적정주가가 상단에 표시됩니다.</span>
            <span className="text-[10px] hidden sm:inline">클릭 시 해당 종목 상세 이동</span>
          </div>
        )}
      </div>

      {/* ── 차트 메인 영역 (가로 스크롤 가능, 풀위드 세로 막대 나열) ── */}
      <div className="relative pt-4 pb-2 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
        {/* 가로 점선 가이드라인 배경 */}
        <div
          className="absolute inset-x-0 top-4 pointer-events-none flex flex-col justify-between"
          style={{ height: `${chartHeight}px` }}
        >
          <div className="w-full border-b border-dashed border-[#f1f5f9]" />
          <div className="w-full border-b border-dashed border-[#f1f5f9]" />
          <div className="w-full border-b border-dashed border-[#e2e8f0]" />
        </div>

        {/* 막대 컬럼 컨테이너 */}
        <div
          className="relative flex items-end gap-3 sm:gap-4 min-w-max px-3"
          style={{ height: `${chartHeight + 110}px` }}
        >
          {items.map((item, idx) => {
            const barHeightPct = Math.max((item.value / maxValue) * 100, 4);
            const barHeightPx = Math.round((barHeightPct / 100) * chartHeight);
            const barColor = item.color || PALETTE[idx % PALETTE.length];
            const isHovered = hoveredIndex === idx;
            const logoUrl = logoMap[item.ticker.toUpperCase()];
            const displayName = item.name || item.ticker;

            return (
              <div
                key={`${item.ticker}-${idx}`}
                className="relative flex flex-col items-center cursor-pointer group select-none"
                style={{ width: "42px" }}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => onSelectReport(item.report)}
              >
                {/* 호버 시 세로 컬럼 하이라이트 밴드 */}
                {isHovered && (
                  <div
                    className="absolute inset-x-[-6px] top-[-8px] bottom-0 bg-[#f1f5f9]/80 rounded transition-all pointer-events-none"
                    style={{ zIndex: 0 }}
                  />
                )}

                {/* 막대 상단 수치 라벨 */}
                <div
                  className={`text-[10px] sm:text-[11px] font-mono font-bold leading-none mb-1 text-center truncate transition-colors z-10 ${
                    isHovered ? "text-[#0f172a] scale-105" : "text-[#64748b]"
                  }`}
                  style={{ width: "46px" }}
                >
                  {item.displayValue}
                </div>

                {/* 세로 막대 본체 */}
                <div
                  className="w-full flex items-end justify-center z-10"
                  style={{ height: `${chartHeight}px` }}
                >
                  <div
                    className="w-5 sm:w-6 rounded-t-sm transition-all duration-300 ease-out group-hover:brightness-110 shadow-2xs"
                    style={{
                      height: `${barHeightPx}px`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>

                {/* 막대 하단: 종목 로고 아이콘 (18x18px) */}
                <div className="mt-2.5 w-5 h-5 rounded-full border border-[#e2e8f0] bg-white flex items-center justify-center overflow-hidden shrink-0 z-10 group-hover:scale-110 transition-transform">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={item.ticker}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="text-[8px] font-mono font-bold text-[#64748b] uppercase">
                      {item.ticker.slice(0, 2)}
                    </span>
                  )}
                </div>

                {/* [핵심 개선] 로고 하단 대각선 라벨: 절대 로고를 가리지 않도록 top right 축으로 아래 방향 회전 */}
                <div className="relative w-full h-24 pt-1 flex justify-center overflow-visible z-10">
                  <span
                    className={`text-[10px] font-mono whitespace-nowrap transition-colors block text-right select-none ${
                      isHovered
                        ? "text-[#0f172a] font-bold"
                        : "text-[#64748b] group-hover:text-[#334155]"
                    }`}
                    style={{
                      transform: "rotate(-55deg)",
                      transformOrigin: "top right",
                      marginRight: "4px",
                      marginTop: "8px",
                    }}
                  >
                    {displayName.length > 7 ? `${displayName.slice(0, 6)}…` : displayName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
