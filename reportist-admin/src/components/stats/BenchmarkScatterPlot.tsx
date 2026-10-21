"use client";

import React, { useState, useMemo } from "react";
import { GuruReportRow } from "@/types/api";
import { formatPriceByNation } from "@/lib/utils";
import { Sparkles, ExternalLink, HelpCircle } from "lucide-react";

interface ScatterPoint {
  ticker: string;
  name: string;
  xVal: number; // 안전마진 (Upside %)
  yVal: number; // 거장 찬성률 (Approval Rate %)
  report: GuruReportRow;
  color: string;
  isAttractive: boolean; // 우상단 매력 구간
}

interface BenchmarkScatterPlotProps {
  reports: GuruReportRow[];
  onSelectReport: (report: GuruReportRow) => void;
  tickerNameMap?: Record<string, string>;
  logoMap?: Record<string, string>;
}

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
];

export function BenchmarkScatterPlot({
  reports,
  onSelectReport,
  tickerNameMap = {},
  logoMap = {},
}: BenchmarkScatterPlotProps) {
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);

  // 데이터 가공 (X축: 안전마진 상승여력, Y축: 거장 찬성률)
  const points = useMemo<ScatterPoint[]>(() => {
    return reports
      .filter((r) => typeof r.votes_buy === "number")
      .map((r, idx) => {
        const totalVotes =
          (r.votes_buy || 0) +
          (r.votes_watch || 0) +
          (r.votes_hold || 0) +
          (r.votes_sell || 0) || 13;
        const approvalRate = Math.round(((r.votes_buy || 0) / totalVotes) * 100);

        let upside = 0;
        if (typeof r.upside_pct === "number") {
          upside = Math.round(r.upside_pct);
        } else if (r.fair_value && r.current_price && r.current_price > 0) {
          upside = Math.round(((r.fair_value - r.current_price) / r.current_price) * 100);
        }

        const ticker = r.ticker.toUpperCase();
        const name = tickerNameMap[ticker] || r.company_name || ticker;
        const isAttractive = upside >= 15 && approvalRate >= 45;

        return {
          ticker,
          name,
          xVal: upside,
          yVal: approvalRate,
          report: r,
          color: isAttractive ? "#059669" : PALETTE[idx % PALETTE.length],
          isAttractive,
        };
      });
  }, [reports, tickerNameMap]);

  // 좌표 계산 (SVG ViewBox: 800 x 420)
  const svgWidth = 840;
  const svgHeight = 440;
  const padding = { top: 40, right: 50, bottom: 60, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // 축 범위
  const minX = -40; // -40%
  const maxX = 60; // +60%
  const minY = 0; // 0%
  const maxY = 100; // 100%

  const getSvgX = (x: number) => {
    const clamped = Math.max(minX, Math.min(maxX, x));
    return padding.left + ((clamped - minX) / (maxX - minX)) * plotWidth;
  };

  const getSvgY = (y: number) => {
    const clamped = Math.max(minY, Math.min(maxY, y));
    return padding.top + plotHeight - ((clamped - minY) / (maxY - minY)) * plotHeight;
  };

  // Most attractive quadrant (우상단 매력 구간: 안전마진 >= 15%, 찬성률 >= 45%)
  const quadrantX = getSvgX(15);
  const quadrantY = getSvgY(100);
  const quadrantW = getSvgX(maxX) - quadrantX;
  const quadrantH = getSvgY(45) - quadrantY;

  // 파레토 최적선 (Pareto Frontier) 근사 곡선
  const paretoPoints = useMemo(() => {
    const sorted = [...points].sort((a, b) => b.yVal - a.yVal || b.xVal - a.xVal);
    const frontier: ScatterPoint[] = [];
    let maxSoFar = -Infinity;
    for (const p of sorted) {
      if (p.xVal > maxSoFar) {
        frontier.push(p);
        maxSoFar = p.xVal;
      }
    }
    return frontier.sort((a, b) => a.xVal - b.xVal);
  }, [points]);

  const paretoPath = useMemo(() => {
    if (paretoPoints.length < 2) return "";
    return paretoPoints
      .map((p, idx) => {
        const x = getSvgX(p.xVal);
        const y = getSvgY(p.yVal);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [paretoPoints]);

  return (
    <div className="p-5 sm:p-6 rounded-md border border-[#e2e8f0] bg-white shadow-2xs hover:border-[#cbd5e1] transition-all">
      {/* ── 헤더 (Artificial Analysis 1:1 스타일) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
              13인 거장 찬성률과 안전마진 4분면 매트릭스
            </h3>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              핵심 밸류 매트릭스
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">
            X축: 내재가치 상승여력(안전마진 %) · Y축: 13인 거장 합의 찬성률 (%)
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#64748b] shrink-0">
          <span className="px-2 py-1 rounded bg-[#f8fafc] border border-[#e2e8f0]">
            분석 종목: <strong className="text-[#0f172a]">{points.length}개</strong>
          </span>
          <div className="flex items-center gap-1 text-[#94a3b8] text-[10px]">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Reportist Benchmark</span>
          </div>
        </div>
      </div>

      {/* 범례 (Legend) */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-mono mb-3 pt-1 border-t border-[#f1f5f9]">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-emerald-500/20 border border-emerald-500/50" />
          <span className="font-semibold text-emerald-800">
            가장 매력적인 4분면 (Most attractive quadrant: 찬성률 45%↑ & 안전마진 15%↑)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#64748b]">
          <div className="w-4 border-t-2 border-dashed border-[#0f172a]" />
          <span>파레토 최적선 (Pareto line)</span>
        </div>
      </div>

      {/* ── 2차원 산점도 SVG 차트 ── */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[700px] select-none"
        >
          {/* 우상단 가장 매력적인 4분면 하이라이트 배경 (초록 박스) */}
          <rect
            x={quadrantX}
            y={quadrantY}
            width={quadrantW}
            height={quadrantH}
            fill="#10b981"
            fillOpacity="0.08"
            stroke="#10b981"
            strokeWidth="1"
            strokeDasharray="4 4"
            rx="4"
          />
          <text
            x={quadrantX + 10}
            y={quadrantY + 20}
            fill="#059669"
            fontSize="11"
            fontFamily="monospace"
            fontWeight="bold"
          >
            ★ 최우량 가치투자 종목군 (저평가 & 거장 합의)
          </text>

          {/* 배경 격자선 (가로 점선) */}
          {[0, 20, 40, 60, 80, 100].map((yVal) => {
            const y = getSvgY(yVal);
            return (
              <g key={`y-grid-${yVal}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {yVal}%
                </text>
              </g>
            );
          })}

          {/* 배경 격자선 (세로 점선) */}
          {[-40, -20, 0, 20, 40, 60].map((xVal) => {
            const x = getSvgX(xVal);
            return (
              <g key={`x-grid-${xVal}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={svgHeight - padding.bottom}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={x}
                  y={svgHeight - padding.bottom + 18}
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {xVal > 0 ? `+${xVal}%` : `${xVal}%`}
                </text>
              </g>
            );
          })}

          {/* X = 0% 기준선 (적정주가 일치선) */}
          <line
            x1={getSvgX(0)}
            y1={padding.top}
            x2={getSvgX(0)}
            y2={svgHeight - padding.bottom}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* 축 제목 라벨 */}
          <text
            x={svgWidth / 2}
            y={svgHeight - 15}
            fill="#475569"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            내재가치 상승여력 및 안전마진 (Margin of Safety %) →
          </text>

          <text
            x={15}
            y={svgHeight / 2}
            fill="#475569"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
            transform={`rotate(-90 15 ${svgHeight / 2})`}
          >
            13인 거장 합의 찬성률 (%) ↑
          </text>

          {/* 파레토 최적선 (점선) */}
          {paretoPath && (
            <path
              d={paretoPath}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.7"
            />
          )}

          {/* 종목 데이터 포인트 (산점도 원형 점들) */}
          {points.map((p, idx) => {
            const cx = getSvgX(p.xVal);
            const cy = getSvgY(p.yVal);
            const isHovered = hoveredPoint?.ticker === p.ticker;

            return (
              <g
                key={`${p.ticker}-${idx}`}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
                onClick={() => onSelectReport(p.report)}
              >
                {/* 호버 시 펄스 원 */}
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="12"
                    fill={p.color}
                    fillOpacity="0.25"
                    className="animate-ping"
                  />
                )}

                {/* 메인 포인트 점 */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 7 : p.isAttractive ? 5.5 : 4.5}
                  fill={p.color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* 종목 라벨 (매력 종목이거나 호버 종목이면 표시) */}
                {(p.isAttractive || isHovered || p.yVal >= 60) && (
                  <text
                    x={cx + 8}
                    y={cy + 3}
                    fill={isHovered ? "#0f172a" : p.isAttractive ? "#047857" : "#475569"}
                    fontSize={isHovered ? "11" : "9.5"}
                    fontFamily="monospace"
                    fontWeight={isHovered || p.isAttractive ? "bold" : "normal"}
                  >
                    {p.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* 플로팅 툴팁 (호버 시 마우스 위치 근처 표시) */}
        {hoveredPoint && (
          <div
            className="absolute z-30 pointer-events-none bg-[#0f172a] text-white p-3 rounded-md shadow-xl text-xs font-mono"
            style={{
              left: `${Math.min(Math.max(getSvgX(hoveredPoint.xVal) - 80, 20), svgWidth - 220)}px`,
              top: `${Math.max(getSvgY(hoveredPoint.yVal) - 95, 10)}px`,
              minWidth: "190px",
            }}
          >
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-700">
              <span className="font-bold text-white text-sm">
                {hoveredPoint.name}
              </span>
              <span className="text-slate-400">({hoveredPoint.ticker})</span>
            </div>

            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">거장 찬성률:</span>
                <span className="font-bold text-emerald-400">
                  {hoveredPoint.yVal}% ({hoveredPoint.report.votes_buy || 0}/13인)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">안전마진(상승여력):</span>
                <span
                  className={`font-bold ${
                    hoveredPoint.xVal > 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {hoveredPoint.xVal > 0 ? `+${hoveredPoint.xVal}%` : `${hoveredPoint.xVal}%`}
                </span>
              </div>
              {hoveredPoint.report.current_price && hoveredPoint.report.fair_value && (
                <div className="flex justify-between text-slate-300 pt-0.5">
                  <span className="text-slate-400">현재/적정:</span>
                  <span>
                    {formatPriceByNation(hoveredPoint.report.current_price, undefined, hoveredPoint.ticker)} →{" "}
                    {formatPriceByNation(hoveredPoint.report.fair_value, undefined, hoveredPoint.ticker)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-1.5 pt-1 border-t border-slate-800 text-[10px] text-blue-300 flex items-center justify-between">
              <span>{hoveredPoint.report.verdict || "평가 완료"}</span>
              <span>클릭하여 리포트 ↗</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
