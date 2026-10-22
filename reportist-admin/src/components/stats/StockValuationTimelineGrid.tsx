"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  StockTimelineSeries,
} from "@/lib/server/publicCatalog";
import { StockValuationTimelineCard } from "./StockValuationTimelineCard";
import {
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Search,
  Filter,
  Layers,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface StockValuationTimelineGridProps {
  onSelectReport: (report: any) => void;
  logoMap?: Record<string, string>;
  initialMarketFilter?: "all" | "kr" | "us";
}

type SortOption = "fair_ratio" | "safety_ratio" | "name" | "points_count";

export function StockValuationTimelineGrid({
  onSelectReport,
  logoMap = {},
  initialMarketFilter = "all",
}: StockValuationTimelineGridProps) {
  const { isEn } = useLanguage();
  const [items, setItems] = useState<StockTimelineSeries[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [marketFilter, setMarketFilter] = useState<"all" | "kr" | "us">(
    initialMarketFilter
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("fair_ratio");
  const [visibleCount, setVisibleCount] = useState<number>(30); // 점진적 렌더링
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 시계열 데이터 API 호출
  useEffect(() => {
    let mounted = true;
    fetch("/api/stats/stock-timelines")
      .then((res) => res.json())
      .then((res) => {
        if (mounted && res?.ok && Array.isArray(res.items)) {
          setItems(res.items);
        }
      })
      .catch((err) => {
        console.warn("Failed to load stock timelines:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // 시장별 필터링
  const filteredByMarket = useMemo(() => {
    return items.filter((item) => {
      if (marketFilter === "kr") return item.isKr;
      if (marketFilter === "us") return !item.isKr;
      return true;
    });
  }, [items, marketFilter]);

  // 검색어 필터링
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return filteredByMarket;
    const q = searchQuery.toLowerCase().trim();
    return filteredByMarket.filter(
      (item) =>
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [filteredByMarket, searchQuery]);

  // 정렬
  const sortedItems = useMemo(() => {
    return [...filteredBySearch].sort((a, b) => {
      if (sortBy === "fair_ratio") {
        return (b.latestFairRatio || 0) - (a.latestFairRatio || 0);
      }
      if (sortBy === "safety_ratio") {
        return (b.latestSafetyRatio || 0) - (a.latestSafetyRatio || 0);
      }
      if (sortBy === "points_count") {
        return b.points.length - a.points.length;
      }
      return a.name.localeCompare(b.name, isEn ? "en" : "ko");
    });
  }, [filteredBySearch, sortBy, isEn]);

  // 무한 스크롤 / 점진적 렌더링 옵저버
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 30, sortedItems.length));
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [sortedItems.length]);

  // 검색이나 필터 변경 시 visibleCount 초기화
  useEffect(() => {
    setVisibleCount(30);
  }, [marketFilter, searchQuery, sortBy]);

  const krCount = useMemo(() => items.filter((i) => i.isKr).length, [items]);
  const usCount = useMemo(() => items.filter((i) => !i.isKr).length, [items]);

  const currentlyVisible = sortedItems.slice(0, visibleCount);

  return (
    <div className="p-5 sm:p-6 rounded-md border border-[#e2e8f0] bg-white shadow-2xs hover:border-[#cbd5e1] transition-all space-y-5">
      {/* ── 1. 헤더 영역 ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#f1f5f9]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-[#0f172a] tracking-tight">
              {isEn ? "Stock Valuation Timeline Collection" : "종목별 밸류에이션 타임라인 컬렉션"}
            </h3>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {isEn ? `${items.length} Stock Charts` : `총 ${items.length}개 종목 차트`}
            </span>
          </div>

          <p className="text-xs text-[#64748b] mt-1 font-mono">
            {isEn
              ? "X: Published report dates · Y: Fair Value / Price (Blue) & Safety Margin / Price (Green)"
              : "X축: 실제 작성된 분석 일자(미작성일 제외) · Y축: 적정가/종가(파란선) & 안전마진/종가(초록선) 추이"}
          </p>
        </div>

        {/* 우측 상단 브랜딩 */}
        <div className="flex items-center gap-2 text-xs font-mono text-[#64748b] shrink-0">
          <div className="flex items-center gap-1 text-[#94a3b8] text-[10px]">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Reportist Benchmark</span>
          </div>
        </div>
      </div>

      {/* ── 2. 지표 가이드 범례 바 ── */}
      <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
            <span className="font-bold text-blue-800">
              {isEn
                ? "Fair Value / Price (%) : Intrinsic Valuation Trend"
                : "적정가/종가 (%) : 내재가치 밸류에이션 추이선"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#059669] rounded-2xs" />
            <span className="font-bold text-emerald-800">
              {isEn
                ? "Safety Margin / Price (%) : Conservative Safety Margin"
                : "안전마진/종가 (%) : 보수적 안전마진 확보선"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[#64748b]">
            <div className="w-4 border-t-2 border-dashed border-[#94a3b8]" />
            <span>
              {isEn
                ? "100% Current Price Baseline (100%↑ Undervalued / Safety Zone)"
                : "100% 현재 주가 기준선 (100%↑ 저평가/안전마진 구간)"}
            </span>
          </div>
        </div>

        <span className="text-[11px] text-[#94a3b8]">
          {isEn
            ? "* Plotted across published report dates sequentially"
            : "* 보고서가 작성된 날짜 포인트만 순서대로 연속 연결"}
        </span>
      </div>

      {/* ── 3. 컨트롤 바: 시장 필터, 정렬, 검색 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* 시장 필터 탭 (전체 / 국장 / 미장) */}
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-[#f1f5f9] border border-[#e2e8f0]">
          <button
            onClick={() => setMarketFilter("all")}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
              marketFilter === "all"
                ? "bg-white text-[#0f172a] shadow-xs font-bold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            {isEn ? `All (${items.length})` : `전체 (${items.length})`}
          </button>
          <button
            onClick={() => setMarketFilter("kr")}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
              marketFilter === "kr"
                ? "bg-white text-[#0f172a] shadow-xs font-bold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            {isEn ? `Korean Stocks KR (${krCount})` : `국내 주식 🇰🇷 (${krCount})`}
          </button>
          <button
            onClick={() => setMarketFilter("us")}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all cursor-pointer ${
              marketFilter === "us"
                ? "bg-white text-[#0f172a] shadow-xs font-bold"
                : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            {isEn ? `US Stocks US (${usCount})` : `미국 주식 🇺🇸 (${usCount})`}
          </button>
        </div>

        {/* 검색 및 정렬 */}
        <div className="flex items-center gap-2">
          {/* 종목 검색창 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEn ? "Search ticker / company name..." : "종목명/티커 검색"}
              className="pl-8 pr-3 py-1 text-xs rounded border border-[#e2e8f0] bg-white placeholder-[#94a3b8] focus:outline-none focus:border-[#0f172a] w-36 sm:w-48 font-mono"
            />
          </div>

          {/* 정렬 셀렉트 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-2.5 py-1 text-xs rounded border border-[#e2e8f0] bg-white text-[#0f172a] font-mono focus:outline-none cursor-pointer"
          >
            <option value="fair_ratio">{isEn ? "Highest Fair/Price" : "최신 적정가/종가 높은 순"}</option>
            <option value="safety_ratio">{isEn ? "Highest Safety/Price" : "최신 안전마진 높은 순"}</option>
            <option value="points_count">{isEn ? "Most Report Dates" : "분석 일자 많은 순"}</option>
            <option value="name">{isEn ? "Alphabetical Order" : "종목명 가나다 순"}</option>
          </select>
        </div>
      </div>

      {/* ── 4. 120개 종목별 시계열 차트 그리드 ── */}
      {loading ? (
        <div className="p-16 text-center text-xs font-mono text-[#94a3b8]">
          {isEn
            ? "Loading stock valuation timeline data..."
            : "전 종목 시계열 밸류에이션 차트 데이터를 불러오는 중입니다..."}
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-[#94a3b8]">
          {isEn
            ? "No matching stocks found."
            : "일치하는 분석 종목이 없습니다."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 w-full">
            {currentlyVisible.map((series) => {
              const logoUrl = logoMap[series.ticker.toUpperCase()];
              return (
                <StockValuationTimelineCard
                  key={series.ticker}
                  series={series}
                  logoUrl={logoUrl}
                  onSelect={() =>
                    onSelectReport({
                      ticker: series.ticker,
                      company_name: series.name,
                      d: series.latestDate,
                      current_price: series.latestPrice,
                    })
                  }
                />
              );
            })}
          </div>

          {/* 무한 스크롤 트리거 영역 */}
          {visibleCount < sortedItems.length && (
            <div
              ref={loadMoreRef}
              className="py-6 text-center text-xs font-mono text-[#94a3b8]"
            >
              스크롤하여 더 많은 종목 차트 불러오기 ({currentlyVisible.length} / {sortedItems.length})
            </div>
          )}
        </>
      )}
    </div>
  );
}
