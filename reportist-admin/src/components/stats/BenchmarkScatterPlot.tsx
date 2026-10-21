"use client";

import React, { useState, useMemo } from "react";
import { GuruReportRow } from "@/types/api";
import { formatPriceByNation } from "@/lib/utils";
import { Sparkles, CheckCircle2, ShieldCheck, TrendingUp } from "lucide-react";

export type MatrixMode = "fair_value" | "safety_margin";

interface ScatterPoint {
  ticker: string;
  name: string;
  xVal: number;
  xDisplay: string;
  yVal: number; // 거장 찬성률 (Approval Rate %)
  report: GuruReportRow;
  color: string;
  isAttractive: boolean; // 우상단 매력 구간 여부
  fairRatio?: number; // 적정가 / 종가 (%)
  safetyRatio?: number; // 안전마진 진입가 / 종가 (%)
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
  const [matrixMode, setMatrixMode] = useState<MatrixMode>("fair_value");
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);

  // 데이터 가공 (선택된 모드에 따라 X축 지표 분리)
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

        const curr = r.current_price && r.current_price > 0 ? r.current_price : null;
        const fair = r.fair_value && r.fair_value > 0 ? r.fair_value : null;
        const safety = r.safety_entry && r.safety_entry > 0 ? r.safety_entry : null;

        // 1. 적정가/종가 배율 (%) 및 상승여력 (%)
        let upside = 0;
        let fairRatio = 100;
        if (typeof r.upside_pct === "number") {
          upside = Math.round(r.upside_pct);
          fairRatio = 100 + upside;
        } else if (fair && curr) {
          fairRatio = Math.round((fair / curr) * 100);
          upside = fairRatio - 100;
        }

        // 2. 안전마진 진입가/종가 비율 (%)
        let safetyRatio = 75;
        if (safety && curr) {
          safetyRatio = Math.round((safety / curr) * 100);
        } else if (fairRatio) {
          safetyRatio = Math.round(fairRatio * 0.8);
        }

        const ticker = r.ticker.toUpperCase();
        const name = tickerNameMap[ticker] || r.company_name || ticker;

        let xVal = upside;
        let xDisplay = upside > 0 ? `+${upside}%` : `${upside}%`;
        let isAttractive = upside >= 15 && approvalRate >= 45;

        if (matrixMode === "safety_margin") {
          xVal = safetyRatio;
          xDisplay = `${safetyRatio}%`;
          isAttractive = safetyRatio >= 90 && approvalRate >= 45;
        }

        return {
          ticker,
          name,
          xVal,
          xDisplay,
          yVal: approvalRate,
          report: r,
          color: isAttractive ? "#059669" : PALETTE[idx % PALETTE.length],
          isAttractive,
          fairRatio,
          safetyRatio,
        };
      });
  }, [reports, tickerNameMap, matrixMode]);

  // 가로 풀위드에 맞게 SVG ViewBox 확장 (960 x 440)
  const svgWidth = 960;
  const svgHeight = 440;
  const padding = { top: 40, right: 60, bottom: 60, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // 축 범위
  const minX = matrixMode === "fair_value" ? -40 : 40;
  const maxX = matrixMode === "fair_value" ? 60 : 120;
  const minY = 0;
  const maxY = 100;

  const getSvgX = (x: number) => {
    const clamped = Math.max(minX, Math.min(maxX, x));
    return padding.left + ((clamped - minX) / (maxX - minX)) * plotWidth;
  };

  const getSvgY = (y: number) => {
    const clamped = Math.max(minY, Math.min(maxY, y));
    return padding.top + plotHeight - ((clamped - minY) / (maxY - minY)) * plotHeight;
  };

  // Most attractive quadrant (우상단 매력 구간)
  const attractiveThresholdX = matrixMode === "fair_value" ? 15 : 90;
  const quadrantX = getSvgX(attractiveThresholdX);
  const quadrantY = getSvgY(100);
  const quadrantW = getSvgX(maxX) - quadrantX;
  const quadrantH = getSvgY(45) - quadrantY;

  // 파레토 최적선
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
  }, [paretoPoints, minX, maxX]);

  // [문제 1 완치] 라벨 충돌 방지 및 스마트 오프셋 분산 계산
  const labelLayoutMap = useMemo(() => {
    const layouts = new Map<
      string,
      { x: number; y: number; anchor: "start" | "middle" | "end" }
    >();
    const placed: Array<{ cx: number; cy: number }> = [];

    // 표시 대상 종목들 (매력 종목이거나 찬성률 60% 이상)
    const candidates = points.filter((p) => p.isAttractive || p.yVal >= 60);

    candidates.forEach((p) => {
      const cx = getSvgX(p.xVal);
      const cy = getSvgY(p.yVal);

      // 32px 이내에 이미 배치된 다른 라벨이 있는지 검사
      const conflicting = placed.filter(
        (spot) => Math.hypot(spot.cx - cx, spot.cy - cy) < 32
      );

      if (conflicting.length === 0) {
        // 충돌 없음: 기본 우측 배치
        layouts.set(p.ticker, { x: cx + 8, y: cy + 3.5, anchor: "start" });
        placed.push({ cx, cy });
      } else {
        // 충돌 발생(예: 캐피탈원과 어도비): 위치 분산
        const shiftIndex = conflicting.length % 3;
        if (shiftIndex === 1) {
          // 점 위쪽 중앙 배치
          layouts.set(p.ticker, { x: cx, y: cy - 9, anchor: "middle" });
        } else if (shiftIndex === 2) {
          // 점 오른쪽 아래 대각선 배치
          layouts.set(p.ticker, { x: cx + 8, y: cy + 14, anchor: "start" });
        } else {
          // 점 왼쪽 배치
          layouts.set(p.ticker, { x: cx - 8, y: cy + 3.5, anchor: "end" });
        }
        placed.push({ cx, cy });
      }
    });

    return layouts;
  }, [points, minX, maxX, matrixMode]);

  return (
    <div className="p-5 sm:p-6 rounded-md border border-[#e2e8f0] bg-white shadow-2xs hover:border-[#cbd5e1] transition-all">
      {/* ── 헤더 ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight break-keep">
              {matrixMode === "fair_value"
                ? "13인 거장 찬성률 × 내재가치(적정가) 4분면 매트릭스"
                : "13인 거장 찬성률 × 보수적 안전마진 4분면 매트릭스"}
            </h3>
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                matrixMode === "fair_value"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {matrixMode === "fair_value" ? "적정가 기준" : "안전마진 기준"}
            </span>
          </div>

          <p className="text-xs text-[#64748b] mt-1 font-mono">
            {matrixMode === "fair_value"
              ? "X축: 거장 합의 적정주가 대비 상승여력 (%) · Y축: 13인 거장 합의 찬성률 (%)"
              : "X축: 보수적 안전마진 진입가 / 현재가 (%) · Y축: 13인 거장 합의 찬성률 (%)"}
          </p>
        </div>

        {/* 2개 매트릭스 선택 탭 버튼 */}
        <div className="flex items-center gap-1 p-1 rounded-md bg-[#f1f5f9] border border-[#e2e8f0] self-start lg:self-auto shrink-0">
          <button
            onClick={() => setMatrixMode("fair_value")}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              matrixMode === "fair_value"
                ? "bg-white text-[#0f172a] shadow-xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>① 내재가치(적정가) 매트릭스</span>
          </button>
          <button
            onClick={() => setMatrixMode("safety_margin")}
            className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              matrixMode === "safety_margin"
                ? "bg-white text-[#0f172a] shadow-xs"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>② 보수적 안전마진 매트릭스</span>
          </button>
        </div>
      </div>

      {/* 범례 및 안내 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono mb-3 pt-2 border-t border-[#f1f5f9]">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-sm bg-emerald-500/20 border border-emerald-500/50" />
            <span className="font-semibold text-emerald-800">
              {matrixMode === "fair_value"
                ? "가장 매력적인 4분면 (찬성률 45%↑ & 적정가 상승여력 15%↑)"
                : "가장 매력적인 4분면 (찬성률 45%↑ & 안전마진/종가 90%↑)"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[#64748b]">
            <div className="w-4 border-t-2 border-dashed border-[#0f172a]" />
            <span>파레토 최적선 (Pareto line)</span>
          </div>
        </div>

        <div className="text-[11px] text-[#94a3b8] font-mono">
          분석 종목: <strong className="text-[#0f172a]">{points.length}개</strong>
        </div>
      </div>

      {/* ── 2차원 산점도 SVG 차트 (풀위드 가로 확장) ── */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[760px] select-none"
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
            x={quadrantX + 12}
            y={quadrantY + 22}
            fill="#059669"
            fontSize="11"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {matrixMode === "fair_value"
              ? "★ 고상승여력 & 거장 찬성 종목군 (High Upside)"
              : "★ 강력 하방완충 & 거장 찬성 종목군 (Safe Entry)"}
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
          {(matrixMode === "fair_value"
            ? [-40, -20, 0, 20, 40, 60]
            : [40, 60, 80, 100, 120]
          ).map((xVal) => {
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
                  {matrixMode === "fair_value"
                    ? xVal > 0
                      ? `+${xVal}%`
                      : `${xVal}%`
                    : `${xVal}%`}
                </text>
              </g>
            );
          })}

          {/* 기준선 */}
          <line
            x1={getSvgX(matrixMode === "fair_value" ? 0 : 100)}
            y1={padding.top}
            x2={getSvgX(matrixMode === "fair_value" ? 0 : 100)}
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
            {matrixMode === "fair_value"
              ? "내재가치(적정주가) 상승여력 (Upside %) →"
              : "보수적 안전마진 진입가 / 현재가 (Safety Entry Ratio %) →"}
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

          {/* 파레토 최적선 */}
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

          {/* 종목 데이터 포인트 */}
          {points.map((p, idx) => {
            const cx = getSvgX(p.xVal);
            const cy = getSvgY(p.yVal);
            const isHovered = hoveredPoint?.ticker === p.ticker;
            const layout = labelLayoutMap.get(p.ticker);

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

                {/* [문제 1 완치] 겹침 방지 오프셋 라벨 */}
                {(layout || isHovered) && (
                  <text
                    x={layout ? layout.x : cx + 8}
                    y={layout ? layout.y : cy + 3.5}
                    textAnchor={layout ? layout.anchor : "start"}
                    fill={isHovered ? "#0f172a" : p.isAttractive ? "#047857" : "#475569"}
                    stroke="#ffffff"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    style={{ paintOrder: "stroke fill" }}
                    fontSize={isHovered ? "11.5" : "9.5"}
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

        {/* 플로팅 툴팁 */}
        {hoveredPoint && (
          <div
            className="absolute z-30 pointer-events-none bg-[#0f172a] text-white p-3 rounded-md shadow-xl text-xs font-mono"
            style={{
              left: `${Math.min(Math.max(getSvgX(hoveredPoint.xVal) - 90, 20), svgWidth - 230)}px`,
              top: `${Math.max(getSvgY(hoveredPoint.yVal) - 105, 10)}px`,
              minWidth: "210px",
            }}
          >
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-700">
              <span className="font-bold text-white text-sm">
                {hoveredPoint.name}
              </span>
              <span className="text-slate-400">({hoveredPoint.ticker})</span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">거장 찬성률:</span>
                <span className="font-bold text-emerald-400">
                  {hoveredPoint.yVal}% ({hoveredPoint.report.votes_buy || 0}/13인)
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">적정가/종가 (상승여력):</span>
                <span className="font-bold text-blue-300">
                  {hoveredPoint.fairRatio}% ({hoveredPoint.fairRatio && hoveredPoint.fairRatio > 100 ? `+${hoveredPoint.fairRatio - 100}%` : `${(hoveredPoint.fairRatio || 100) - 100}%`})
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">안전마진 진입가/종가:</span>
                <span className="font-bold text-amber-300">
                  {hoveredPoint.safetyRatio}%
                </span>
              </div>

              {hoveredPoint.report.current_price && (
                <div className="flex justify-between text-slate-300 pt-0.5 border-t border-slate-800">
                  <span className="text-slate-400">현재가:</span>
                  <span>{formatPriceByNation(hoveredPoint.report.current_price, undefined, hoveredPoint.ticker)}</span>
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
