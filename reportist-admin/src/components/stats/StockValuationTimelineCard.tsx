"use client";

import React, { useState } from "react";
import { StockTimelineSeries, StockTimelinePoint } from "@/lib/server/publicCatalog";
import { formatPriceByNation } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getEnglishCompanyName } from "@/lib/tickerAliases";

interface StockValuationTimelineCardProps {
  series: StockTimelineSeries;
  logoUrl?: string;
  onSelect: () => void;
}

export function StockValuationTimelineCard({
  series,
  logoUrl,
  onSelect,
}: StockValuationTimelineCardProps) {
  const { isEn } = useLanguage();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const points = series.points;
  if (!points || points.length === 0) return null;

  // 차트 좌표 계산 (ViewBox: 380 x 170)
  const svgWidth = 380;
  const svgHeight = 165;
  const padding = { top: 24, right: 36, bottom: 28, left: 36 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Y축 범위 계산 (최소 40% ~ 최대값 또는 160%)
  const allRatios = points.flatMap((p) => [p.fairRatio || 100, p.safetyRatio || 100]);
  const maxRatio = Math.max(...allRatios, 140);
  const minRatio = Math.min(...allRatios, 60);

  // 상하 여백 15% 추가
  const domainMax = Math.ceil((maxRatio + 15) / 10) * 10;
  const domainMin = Math.floor((minRatio - 15) / 10) * 10;

  const getX = (index: number) => {
    if (points.length <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (points.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(domainMin, Math.min(domainMax, val));
    return padding.top + plotHeight - ((clamped - domainMin) / (domainMax - domainMin)) * plotHeight;
  };

  // 적정가/종가 선 패스
  const fairPath = points
    .map((p, idx) => {
      const val = p.fairRatio || 100;
      return `${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(val)}`;
    })
    .join(" ");

  // 안전마진/종가 선 패스
  const safetyPath = points
    .map((p, idx) => {
      const val = p.safetyRatio || 100;
      return `${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(val)}`;
    })
    .join(" ");

  const y100 = getY(100);
  const hoveredPoint: StockTimelinePoint | null =
    hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div
      onClick={onSelect}
      className="p-4 rounded-md border border-[#e2e8f0] bg-white shadow-2xs hover:border-[#cbd5e1] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
    >
      {/* ── 카드 상단 헤더 ── */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* 종목 로고 */}
          <div className="w-6 h-6 rounded-full border border-[#e2e8f0] bg-white flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={series.ticker}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <span className="text-[9px] font-mono font-bold text-[#64748b]">
                {series.ticker.slice(0, 2)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-xs sm:text-sm text-[#0f172a] group-hover:text-blue-600 transition-colors truncate">
                {isEn
                  ? (() => {
                      const alias = getEnglishCompanyName(series.ticker, series.name);
                      if (alias && !/[\uac00-\ud7a3]/.test(alias) && alias.toUpperCase() !== series.ticker.toUpperCase()) {
                        return alias;
                      }
                      return series.ticker;
                    })()
                  : series.name}
              </h4>
              <span className="font-mono text-[10px] text-[#94a3b8] shrink-0">
                {series.ticker}
              </span>
            </div>
            {series.latestPrice && (
              <p className="text-[10px] text-[#64748b] font-mono">
                {isEn ? "Price: " : "현재가 "}
                {formatPriceByNation(series.latestPrice, undefined, series.ticker)}
              </p>
            )}
          </div>
        </div>

        {/* 최신 수치 뱃지 (첨부 1과 동일한 디자인 규격) */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {series.latestFairRatio !== null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#0f172a] text-white text-[10px] font-mono font-bold">
              {isEn ? "Fair/Price: " : "적정가/종가: "}{series.latestFairRatio}%
            </span>
          )}
          {series.latestSafetyRatio !== null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold">
              {isEn ? "Safety/Price: " : "안전마진/종가: "}{series.latestSafetyRatio}%
            </span>
          )}
        </div>
      </div>

      {/* ── SVG 시계열 차트 본체 (실제 보고서 작성 날짜 포인트들만 순서대로 나열) ── */}
      <div className="relative w-full pt-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
        >
          {/* 100% 현재 주가 기준선 (점선) */}
          {y100 >= padding.top && y100 <= svgHeight - padding.bottom && (
            <g>
              <line
                x1={padding.left}
                y1={y100}
                x2={svgWidth - padding.right}
                y2={y100}
                stroke="#cbd5e1"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <text
                x={svgWidth - padding.right + 4}
                y={y100 + 3}
                fill="#94a3b8"
                fontSize="8"
                fontFamily="monospace"
              >
                100%
              </text>
            </g>
          )}

          {/* 적정가/종가 선 (파란색) */}
          {fairPath && (
            <path
              d={fairPath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* 안전마진/종가 선 (에메랄드색) */}
          {safetyPath && (
            <path
              d={safetyPath}
              fill="none"
              stroke="#059669"
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* 실제 보고서가 작성된 날짜별 노드 포인트들 */}
          {points.map((p, idx) => {
            const x = getX(idx);
            const yFair = getY(p.fairRatio || 100);
            const ySafety = getY(p.safetyRatio || 100);
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={`${p.date}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setHoveredIndex(idx);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  setHoveredIndex(null);
                }}
              >
                {/* 호버 세로 가이드라인 */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={svgHeight - padding.bottom}
                    stroke="#0f172a"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {/* 적정가 원형 노드 (Blue) */}
                <circle
                  cx={x}
                  cy={yFair}
                  r={isHovered ? 4.5 : 3}
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* 안전마진 사각 노드 (Emerald) */}
                <rect
                  x={x - (isHovered ? 3.5 : 2.5)}
                  y={ySafety - (isHovered ? 3.5 : 2.5)}
                  width={isHovered ? 7 : 5}
                  height={isHovered ? 7 : 5}
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />

                {/* X축 실제 보고서 작성 날짜 라벨 (비어있는 날짜 없이 연속 노출) */}
                <text
                  x={x}
                  y={svgHeight - padding.bottom + 14}
                  fill={isHovered ? "#0f172a" : "#94a3b8"}
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight={isHovered ? "bold" : "normal"}
                  textAnchor="middle"
                >
                  {p.displayDate}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 호버 시 플로팅 툴팁 */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-[#0f172a] text-white p-2 rounded shadow-lg text-[10px] font-mono"
            style={{
              left: `${Math.min(
                Math.max(getX(hoveredIndex!) - 60, 10),
                svgWidth - 140
              )}px`,
              top: "0px",
              minWidth: "130px",
            }}
          >
            <div className="font-bold text-white border-b border-slate-700 pb-0.5 mb-1 flex justify-between">
              <span>{hoveredPoint.date}</span>
              <span className="text-blue-300">
                {formatPriceByNation(hoveredPoint.curr, undefined, series.ticker)}
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-400">{isEn ? "Fair/Price:" : "적정가/종가:"}</span>
                <span className="font-bold text-blue-300">
                  {hoveredPoint.fairRatio}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isEn ? "Safety/Price:" : "안전마진/종가:"}</span>
                <span className="font-bold text-emerald-300">
                  {hoveredPoint.safetyRatio}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 카드 하단 범례 및 바로가기 안내 */}
      <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-[#f1f5f9] text-[#94a3b8]">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-blue-600 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" /> {isEn ? "Fair Value" : "적정가"}
          </span>
          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-2xs" /> {isEn ? "Safety Margin" : "안전마진"}
          </span>
        </div>

        <span className="flex items-center text-[#64748b] group-hover:text-blue-600 transition-colors">
          {isEn ? "View Report" : "리포트 보기"} <ChevronRight className="w-3 h-3 ml-0.5" />
        </span>
      </div>
    </div>
  );
}
