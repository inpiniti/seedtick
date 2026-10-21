"use client";

import React, { useState, useMemo } from "react";
import { GuruReportRow } from "@/types/api";
import { Sparkles, Calendar, TrendingUp } from "lucide-react";

interface TimelineDateGroup {
  date: string;
  displayDate: string;
  avgApprovalRate: number;
  topStock: {
    ticker: string;
    name: string;
    rate: number;
    votesBuy: number;
    report: GuruReportRow;
  } | null;
  stocksCount: number;
}

interface BenchmarkTimelineChartProps {
  reports: GuruReportRow[];
  onSelectReport: (report: GuruReportRow) => void;
  tickerNameMap?: Record<string, string>;
}

export function BenchmarkTimelineChart({
  reports,
  onSelectReport,
  tickerNameMap = {},
}: BenchmarkTimelineChartProps) {
  const [hoveredDate, setHoveredDate] = useState<TimelineDateGroup | null>(null);

  // 날짜별 그룹 집계
  const dateGroups = useMemo<TimelineDateGroup[]>(() => {
    const map = new Map<string, GuruReportRow[]>();
    for (const r of reports) {
      if (!r.d) continue;
      const group = map.get(r.d) || [];
      group.push(r);
      map.set(r.d, group);
    }

    const sortedDates = Array.from(map.keys()).sort();
    // 최근 10~15개 날짜 추출
    const recentDates = sortedDates.slice(-12);

    return recentDates.map((date) => {
      const list = map.get(date) || [];
      let totalRate = 0;
      let topStock: TimelineDateGroup["topStock"] = null;

      for (const r of list) {
        const totalVotes =
          (r.votes_buy || 0) +
          (r.votes_watch || 0) +
          (r.votes_hold || 0) +
          (r.votes_sell || 0) || 13;
        const rate = Math.round(((r.votes_buy || 0) / totalVotes) * 100);
        totalRate += rate;

        if (!topStock || rate > topStock.rate) {
          const ticker = r.ticker.toUpperCase();
          topStock = {
            ticker,
            name: tickerNameMap[ticker] || r.company_name || ticker,
            rate,
            votesBuy: r.votes_buy || 0,
            report: r,
          };
        }
      }

      const avgRate = list.length > 0 ? Math.round(totalRate / list.length) : 0;
      // YYYY-MM-DD -> MM/DD
      const parts = date.split("-");
      const displayDate = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : date;

      return {
        date,
        displayDate,
        avgApprovalRate: avgRate,
        topStock,
        stocksCount: list.length,
      };
    });
  }, [reports, tickerNameMap]);

  const svgWidth = 840;
  const svgHeight = 360;
  const padding = { top: 40, right: 60, bottom: 50, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const minRate = 0;
  const maxRate = 100;

  const getSvgX = (index: number) => {
    if (dateGroups.length <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (dateGroups.length - 1)) * plotWidth;
  };

  const getSvgY = (rate: number) => {
    const clamped = Math.max(minRate, Math.min(maxRate, rate));
    return padding.top + plotHeight - ((clamped - minRate) / (maxRate - minRate)) * plotHeight;
  };

  // Artificial Analysis 스타일 스텝 라인 (Step line path)
  const stepLinePath = useMemo(() => {
    if (dateGroups.length === 0) return "";
    let path = "";
    dateGroups.forEach((group, idx) => {
      const x = getSvgX(idx);
      const y = getSvgY(group.topStock ? group.topStock.rate : group.avgApprovalRate);
      if (idx === 0) {
        path += `M ${x} ${y}`;
      } else {
        const prevX = getSvgX(idx - 1);
        // 수평 이동 후 수직 이동 (스텝 라인)
        path += ` H ${x} V ${y}`;
      }
    });
    return path;
  }, [dateGroups]);

  // 시장 평균 찬성률 추세선
  const avgLinePath = useMemo(() => {
    if (dateGroups.length === 0) return "";
    return dateGroups
      .map((group, idx) => {
        const x = getSvgX(idx);
        const y = getSvgY(group.avgApprovalRate);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [dateGroups]);

  if (dateGroups.length === 0) {
    return null;
  }

  return (
    <div className="p-5 sm:p-6 rounded-md border border-[#e2e8f0] bg-white shadow-2xs hover:border-[#cbd5e1] transition-all">
      {/* ── 헤더 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
              일자별 거장 평가 및 시장 찬성률 추이
            </h3>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              시계열 타임라인
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">
            분석 일자(Release Date)별 시장 전체 평균 찬성률과 일자별 최고 찬성 우량주 추세선
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#64748b] shrink-0">
          <div className="flex items-center gap-1 text-[#94a3b8] text-[10px]">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Reportist Benchmark</span>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap items-center gap-5 text-xs font-mono mb-3 pt-1 border-t border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-[#0f172a] rounded-full" />
          <span className="font-semibold text-[#0f172a]">일자별 최고 찬성주 스텝 추세선 (Top Stock Frontier)</span>
        </div>
        <div className="flex items-center gap-2 text-[#64748b]">
          <div className="w-4 border-t-2 border-dashed border-[#94a3b8]" />
          <span>시장 평균 거장 찬성률 (%)</span>
        </div>
      </div>

      {/* ── SVG 시계열 차트 ── */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[700px] select-none"
        >
          {/* 가로 점선 그리드 */}
          {[0, 25, 50, 75, 100].map((rate) => {
            const y = getSvgY(rate);
            return (
              <g key={`timeline-grid-${rate}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={svgWidth - padding.right}
                  y2={y}
                  stroke="#f1f5f9"
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
                  {rate}%
                </text>
              </g>
            );
          })}

          {/* 시장 평균선 (점선) */}
          {avgLinePath && (
            <path
              d={avgLinePath}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* 최고 찬성주 스텝 라인 (Artificial Analysis 시그니처 검정 계단식 선) */}
          {stepLinePath && (
            <path
              d={stepLinePath}
              fill="none"
              stroke="#0f172a"
              strokeWidth="2"
            />
          )}

          {/* 일자별 데이터 노드 (스퀘어 마커) */}
          {dateGroups.map((group, idx) => {
            const x = getSvgX(idx);
            const y = getSvgY(group.topStock ? group.topStock.rate : group.avgApprovalRate);
            const isHovered = hoveredDate?.date === group.date;

            return (
              <g
                key={`node-${group.date}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredDate(group)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() => {
                  if (group.topStock) onSelectReport(group.topStock.report);
                }}
              >
                {/* 세로 가이드라인 (호버 시) */}
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

                {/* 사각 노드 마커 (Artificial Analysis 스타일) */}
                <rect
                  x={x - 4}
                  y={y - 4}
                  width="8"
                  height="8"
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  className={isHovered ? "scale-125 transition-transform" : ""}
                />

                {/* 최고 종목명 라벨 */}
                {group.topStock && (
                  <text
                    x={x + 6}
                    y={y - 8}
                    fill={isHovered ? "#0f172a" : "#475569"}
                    fontSize={isHovered ? "11" : "9.5"}
                    fontFamily="monospace"
                    fontWeight={isHovered ? "bold" : "normal"}
                  >
                    {group.topStock.name} ({group.topStock.rate}%)
                  </text>
                )}

                {/* X축 날짜 라벨 */}
                <text
                  x={x}
                  y={svgHeight - padding.bottom + 18}
                  fill={isHovered ? "#0f172a" : "#94a3b8"}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight={isHovered ? "bold" : "normal"}
                  textAnchor="middle"
                >
                  {group.displayDate}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 툴팁 */}
        {hoveredDate && (
          <div
            className="absolute z-30 pointer-events-none bg-[#0f172a] text-white p-3 rounded-md shadow-xl text-xs font-mono"
            style={{
              left: `${Math.min(
                Math.max(
                  getSvgX(dateGroups.findIndex((g) => g.date === hoveredDate.date)) - 80,
                  20
                ),
                svgWidth - 220
              )}px`,
              top: "15px",
              minWidth: "180px",
            }}
          >
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-700">
              <span className="font-bold text-white text-sm">
                {hoveredDate.date}
              </span>
              <span className="text-slate-400">({hoveredDate.stocksCount}개 분석)</span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">시장 평균 찬성률:</span>
                <span className="font-bold text-slate-200">
                  {hoveredDate.avgApprovalRate}%
                </span>
              </div>
              {hoveredDate.topStock && (
                <div className="pt-1 border-t border-slate-800">
                  <div className="flex justify-between font-bold text-emerald-400">
                    <span>최고 찬성주:</span>
                    <span>{hoveredDate.topStock.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[10px] mt-0.5">
                    <span>찬성 표수:</span>
                    <span>{hoveredDate.topStock.votesBuy}표 ({hoveredDate.topStock.rate}%)</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2 pt-1 border-t border-slate-800 text-[10px] text-blue-300 flex items-center justify-between">
              <span>{hoveredDate.topStock?.ticker}</span>
              <span>클릭하여 리포트 ↗</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
