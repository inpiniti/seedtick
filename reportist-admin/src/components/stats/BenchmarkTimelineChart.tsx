"use client";

import React, { useState, useEffect } from "react";
import { GuruReportRow } from "@/types/api";
import { Sparkles, Calendar, TrendingUp } from "lucide-react";
import { TimelineStatItem } from "@/lib/server/publicCatalog";

interface BenchmarkTimelineChartProps {
  reports?: GuruReportRow[];
  initialTimelineData?: TimelineStatItem[];
  onSelectReport: (report: GuruReportRow | any) => void;
  tickerNameMap?: Record<string, string>;
}

export function BenchmarkTimelineChart({
  initialTimelineData,
  onSelectReport,
}: BenchmarkTimelineChartProps) {
  const [timelineData, setTimelineData] = useState<TimelineStatItem[]>(
    initialTimelineData || []
  );
  const [hoveredItem, setHoveredItem] = useState<TimelineStatItem | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialTimelineData || initialTimelineData.length === 0);

  useEffect(() => {
    if (timelineData.length > 0) return;

    let mounted = true;
    fetch("/api/stats/timeline")
      .then((res) => res.json())
      .then((res) => {
        if (mounted && res?.ok && Array.isArray(res.items) && res.items.length > 0) {
          setTimelineData(res.items);
        }
      })
      .catch((err) => {
        console.warn("Failed to load timeline data:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [timelineData.length]);

  const svgWidth = 840;
  const svgHeight = 360;
  const padding = { top: 40, right: 60, bottom: 50, left: 60 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  const minRate = 0;
  const maxRate = 100;

  const getSvgX = (index: number) => {
    if (timelineData.length <= 1) return padding.left + plotWidth / 2;
    return padding.left + (index / (timelineData.length - 1)) * plotWidth;
  };

  const getSvgY = (rate: number) => {
    const clamped = Math.max(minRate, Math.min(maxRate, rate));
    return padding.top + plotHeight - ((clamped - minRate) / (maxRate - minRate)) * plotHeight;
  };

  // Artificial Analysis 스타일 스텝 라인 (Step line path)
  const stepLinePath = React.useMemo(() => {
    if (timelineData.length === 0) return "";
    let path = "";
    timelineData.forEach((item, idx) => {
      const x = getSvgX(idx);
      const y = getSvgY(item.topStock ? item.topStock.rate : item.avgApprovalRate);
      if (idx === 0) {
        path += `M ${x} ${y}`;
      } else {
        path += ` H ${x} V ${y}`;
      }
    });
    return path;
  }, [timelineData]);

  // 시장 평균 찬성률 추세선
  const avgLinePath = React.useMemo(() => {
    if (timelineData.length === 0) return "";
    return timelineData
      .map((item, idx) => {
        const x = getSvgX(idx);
        const y = getSvgY(item.avgApprovalRate);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [timelineData]);

  if (loading && timelineData.length === 0) {
    return (
      <div className="p-8 rounded-md border border-[#e2e8f0] bg-white text-center text-xs text-[#94a3b8] font-mono">
        일자별 거장 평가 시계열 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (timelineData.length === 0) {
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
              최근 {timelineData.length}개 분석일
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
          <span className="font-semibold text-[#0f172a]">
            일자별 최고 찬성주 스텝 추세선 (Top Stock Frontier)
          </span>
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
          {timelineData.map((item, idx) => {
            const x = getSvgX(idx);
            const y = getSvgY(item.topStock ? item.topStock.rate : item.avgApprovalRate);
            const isHovered = hoveredItem?.date === item.date;

            return (
              <g
                key={`node-${item.date}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => {
                  if (item.topStock) {
                    onSelectReport({ ticker: item.topStock.ticker, d: item.date });
                  }
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

                {/* 사각 노드 마커 */}
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
                {item.topStock && (
                  <text
                    x={x + 6}
                    y={y - 8}
                    fill={isHovered ? "#0f172a" : "#475569"}
                    fontSize={isHovered ? "11" : "9.5"}
                    fontFamily="monospace"
                    fontWeight={isHovered ? "bold" : "normal"}
                  >
                    {item.topStock.name} ({item.topStock.rate}%)
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
                  {item.displayDate}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 툴팁 */}
        {hoveredItem && (
          <div
            className="absolute z-30 pointer-events-none bg-[#0f172a] text-white p-3 rounded-md shadow-xl text-xs font-mono"
            style={{
              left: `${Math.min(
                Math.max(
                  getSvgX(timelineData.findIndex((g) => g.date === hoveredItem.date)) - 80,
                  20
                ),
                svgWidth - 220
              )}px`,
              top: "15px",
              minWidth: "190px",
            }}
          >
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-700">
              <span className="font-bold text-white text-sm">
                {hoveredItem.date}
              </span>
              <span className="text-slate-400">({hoveredItem.stocksCount}개 분석)</span>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">시장 평균 찬성률:</span>
                <span className="font-bold text-slate-200">
                  {hoveredItem.avgApprovalRate}%
                </span>
              </div>
              {hoveredItem.topStock && (
                <div className="pt-1 border-t border-slate-800">
                  <div className="flex justify-between font-bold text-emerald-400">
                    <span>최고 찬성주:</span>
                    <span>{hoveredItem.topStock.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[10px] mt-0.5">
                    <span>찬성 표수:</span>
                    <span>
                      {hoveredItem.topStock.votesBuy}표 ({hoveredItem.topStock.rate}%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2 pt-1 border-t border-slate-800 text-[10px] text-blue-300 flex items-center justify-between">
              <span>{hoveredItem.topStock?.ticker}</span>
              <span>클릭하여 리포트 ↗</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
