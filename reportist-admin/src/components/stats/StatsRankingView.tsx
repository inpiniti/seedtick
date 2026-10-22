"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { GuruReportRow } from "@/types/api";
import {
  PieChart,
  BarChart2,
  ChevronRight,
  Layers,
} from "lucide-react";
import { DataCache } from "@/lib/dataCache";
import { fetchTickerLogos } from "@/lib/api-client";
import { BenchmarkScatterPlot } from "./BenchmarkScatterPlot";
import { StockValuationTimelineGrid } from "./StockValuationTimelineGrid";
import { useLanguage } from "@/contexts/LanguageContext";

interface StatsRankingViewProps {
  guruReports: GuruReportRow[];
  onSelectReport: (report: GuruReportRow) => void;
  tickerNameMap?: Record<string, string>;
}

type MarketFilter = "all" | "kr" | "us";
type ViewMode = "benchmark" | "table";
type SectionFilter = "all" | "scatter" | "stock_timelines";

export function StatsRankingView({
  guruReports,
  onSelectReport,
  tickerNameMap = {},
}: StatsRankingViewProps) {
  const { isEn } = useLanguage();
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("benchmark");
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>("all");
  const [logoMap, setLogoMap] = useState<Record<string, string>>(() =>
    DataCache.getAllTickerLogos()
  );
  const requestedLogosRef = useRef<Set<string>>(new Set());

  // 티커별 최신 리포트만 추출 (중복 제거)
  const latestReports = useMemo(() => {
    const map = new Map<string, GuruReportRow>();
    for (const report of guruReports) {
      const ticker = report.ticker.toUpperCase();
      const existing = map.get(ticker);
      if (!existing || (report.d && report.d > (existing.d || ""))) {
        map.set(ticker, report);
      }
    }
    return Array.from(map.values());
  }, [guruReports]);

  // 시장별 필터링
  const filteredReports = useMemo(() => {
    return latestReports.filter((report) => {
      const ticker = report.ticker.toUpperCase();
      const isKr = /^\d{6}$/.test(ticker);
      if (marketFilter === "kr") return isKr;
      if (marketFilter === "us") return !isKr;
      return true;
    });
  }, [latestReports, marketFilter]);

  // 종목 표시명 헬퍼
  const getDisplayName = (report: GuruReportRow) => {
    const ticker = report.ticker.toUpperCase();
    return tickerNameMap[ticker] || report.company_name || ticker;
  };

  // 상위 주요 종목 로고 비동기 프리패치
  useEffect(() => {
    const missingTickers = filteredReports
      .map((r) => r.ticker.toUpperCase())
      .filter((t) => !logoMap[t] && !requestedLogosRef.current.has(t))
      .slice(0, 35);

    if (missingTickers.length === 0) return;

    for (const t of missingTickers) requestedLogosRef.current.add(t);

    fetchTickerLogos(missingTickers, missingTickers.length)
      .then((res) => {
        if (!res?.items) return;
        const newLogos: Record<string, string> = {};
        for (const item of res.items) {
          if (item.logo_image_url) {
            newLogos[item.ticker.toUpperCase()] = item.logo_image_url;
            DataCache.setTickerLogo(item.ticker.toUpperCase(), item.logo_image_url);
          }
        }
        setLogoMap((prev) => ({ ...prev, ...newLogos }));
      })
      .catch(() => {});
  }, [filteredReports, logoMap]);

  // 시장 전체 거장 센티먼트 통계
  const marketSentiment = useMemo(() => {
    let totalBuy = 0;
    let totalWatch = 0;
    let totalSell = 0;

    for (const r of filteredReports) {
      totalBuy += typeof r.votes_buy === "number" ? r.votes_buy : 0;
      totalWatch +=
        (typeof r.votes_watch === "number" ? r.votes_watch : 0) +
        (typeof r.votes_hold === "number" ? r.votes_hold : 0);
      totalSell += typeof r.votes_sell === "number" ? r.votes_sell : 0;
    }

    const totalVotes = totalBuy + totalWatch + totalSell;
    const buyPct = totalVotes > 0 ? Math.round((totalBuy / totalVotes) * 100) : 0;
    const watchPct = totalVotes > 0 ? Math.round((totalWatch / totalVotes) * 100) : 0;
    const sellPct = totalVotes > 0 ? 100 - buyPct - watchPct : 0;

    return {
      totalStocks: filteredReports.length,
      totalVotes,
      totalBuy,
      totalWatch,
      totalSell,
      buyPct,
      watchPct,
      sellPct,
    };
  }, [filteredReports]);

  // 테이블 뷰용 리스트
  const topBuyRanking = useMemo(() => {
    return [...filteredReports]
      .filter((r) => (r.votes_buy || 0) > 0)
      .sort((a, b) => (b.votes_buy || 0) - (a.votes_buy || 0))
      .slice(0, 15);
  }, [filteredReports]);

  return (
    // [문제 2 완치] 좌우 분할을 완전히 제거하고, 상하(위아래) 수직 스택 Full Width로 구성
    <div className="w-full space-y-6">
      {/* ── 1. 상단 섹션: 05 인덱스 + 타이틀 + 시장 필터 + 컴팩트 센티먼트 바 ── */}
      <div className="border-b border-[#e2e8f0] pb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-[#94a3b8]">
                05
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
                {isEn ? "Guru Vote Statistics & Rankings" : "거장 표결 통계 랭킹"}
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-3xl mt-1">
              {isEn
                ? "Multi-dimensional benchmark hub aggregating voting data and valuation metrics from 13 legendary AI investor personas. Discover premier undervalued stocks using quadrant scatter matrices and multi-stock valuation timelines."
                : "13인의 전설적 투자 대가 AI 에이전트의 표결 합산 데이터와 밸류에이션 수치를 집계한 다차원 벤치마크 허브입니다. Artificial Analysis 스타일의 4분면 산점도 매트릭스와 전 종목별 시계열 밸류에이션 차트로 최우량 저평가 종목을 한눈에 분석하세요."}
            </p>
          </div>

          {/* 시장 필터 탭 & 뷰 모드 토글 */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setMarketFilter("all")}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors cursor-pointer ${
                marketFilter === "all"
                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                  : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
              }`}
            >
              {isEn ? `All (${latestReports.length})` : `전체 (${latestReports.length})`}
            </button>
            <button
              onClick={() => setMarketFilter("kr")}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors cursor-pointer ${
                marketFilter === "kr"
                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                  : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
              }`}
            >
              {isEn ? "Korea KR 🇰🇷" : "국내 주식 🇰🇷"}
            </button>
            <button
              onClick={() => setMarketFilter("us")}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors cursor-pointer ${
                marketFilter === "us"
                  ? "bg-[#0f172a] text-white border-[#0f172a]"
                  : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
              }`}
            >
              {isEn ? "US Market 🇺🇸" : "미국 주식 🇺🇸"}
            </button>

            {/* 뷰 모드 토글 (차트 ☵ vs 테이블 ☰) */}
            <div className="ml-2 flex items-center p-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc]">
              <button
                onClick={() => setViewMode("benchmark")}
                title={isEn ? "Multi-dimensional Benchmark Chart" : "다차원 벤치마크 차트"}
                className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                  viewMode === "benchmark"
                    ? "bg-white text-[#0f172a] shadow-2xs font-semibold"
                    : "text-[#94a3b8] hover:text-[#64748b]"
                }`}
              >
                <BarChart2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                title={isEn ? "Rankings Table" : "순위 리스트 테이블"}
                className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-[#0f172a] shadow-2xs font-semibold"
                    : "text-[#94a3b8] hover:text-[#64748b]"
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 가로형 시장 거장 센티먼트 요약 바 */}
        <div className="p-3.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#0f172a]" />
            <span className="font-bold text-[#0f172a]">
              {isEn
                ? `Market Consensus Sentiment (${marketSentiment.totalStocks} Stocks)`
                : `시장 거장 심사 현황 (${marketSentiment.totalStocks}개 분석)`}
            </span>
          </div>

          <div className="flex items-center gap-4 font-mono">
            <span className="text-emerald-700 font-semibold">{isEn ? "Buy" : "찬성"} {marketSentiment.buyPct}%</span>
            <span className="text-amber-700 font-semibold">{isEn ? "Hold" : "관망"} {marketSentiment.watchPct}%</span>
            <span className="text-rose-700 font-semibold">{isEn ? "Sell" : "매도"} {marketSentiment.sellPct}%</span>
            <div className="w-32 sm:w-48 h-2 rounded-full overflow-hidden flex bg-[#e2e8f0]">
              <div style={{ width: `${marketSentiment.buyPct}%` }} className="bg-emerald-500" />
              <div style={{ width: `${marketSentiment.watchPct}%` }} className="bg-amber-400" />
              <div style={{ width: `${marketSentiment.sellPct}%` }} className="bg-rose-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. 섹션 바로가기 탭 태그바 ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSectionFilter("all")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
            sectionFilter === "all"
              ? "bg-[#0f172a] text-white"
              : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
          }`}
        >
          {isEn ? "View All" : "전체 보기"}
        </button>
        <button
          onClick={() => setSectionFilter("scatter")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
            sectionFilter === "scatter"
              ? "bg-[#0f172a] text-white"
              : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
          }`}
        >
          {isEn ? "Quadrant Scatter Matrix" : "4분면 산점도 매트릭스"}
        </button>
        <button
          onClick={() => setSectionFilter("stock_timelines")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
            sectionFilter === "stock_timelines"
              ? "bg-[#0f172a] text-white"
              : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
          }`}
        >
          {isEn
            ? `Valuation Timeline (${filteredReports.length})`
            : `전 종목별 밸류 타임라인 (${filteredReports.length}개)`}
        </button>
      </div>

      {/* ── 3. 본문: 100% Full Width 벤치마크 룸 ── */}
      {viewMode === "benchmark" && (
        <div className="space-y-6 w-full">
          {/* 1. [복원] Artificial Analysis 스타일 4분면 산점도 매트릭스 (첨부 그림 1) */}
          {(sectionFilter === "all" || sectionFilter === "scatter") && (
            <BenchmarkScatterPlot
              reports={filteredReports}
              onSelectReport={onSelectReport}
              tickerNameMap={tickerNameMap}
              logoMap={logoMap}
            />
          )}

          {/* 2. [만족 피드백 기능] 전 종목별 밸류에이션 타임라인 컬렉션 (X: 작성일, Y: 적정가/종가 & 안전마진/종가) */}
          {(sectionFilter === "all" || sectionFilter === "stock_timelines") && (
            <StockValuationTimelineGrid
              onSelectReport={onSelectReport}
              logoMap={logoMap}
              initialMarketFilter={marketFilter}
            />
          )}
        </div>
      )}

      {/* ── 4. 뷰 모드 2: 심플 순위 테이블 ── */}
      {viewMode === "table" && (
        <div className="border border-[#e2e8f0] rounded-md bg-white overflow-hidden shadow-xs divide-y divide-[#f1f5f9] w-full">
          {topBuyRanking.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#94a3b8]">
              {isEn ? "No stocks found for this criteria." : "해당 조건의 분석 종목 데이터가 없습니다."}
            </div>
          ) : (
            topBuyRanking.map((report, idx) => {
              const displayName = getDisplayName(report);
              const votesBuy = report.votes_buy || 0;
              const logoUrl = logoMap[report.ticker.toUpperCase()];

              return (
                <button
                  key={report.ticker}
                  onClick={() => onSelectReport(report)}
                  className="w-full px-4 py-3.5 text-left hover:bg-[#f8fafc] transition-colors flex items-center justify-between gap-4 group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`w-6 text-center font-mono text-xs font-bold shrink-0 ${
                        idx === 0
                          ? "text-[#0f172a] font-black"
                          : idx < 3
                          ? "text-[#334155] font-bold"
                          : "text-[#94a3b8]"
                      }`}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>

                    <div className="w-6 h-6 rounded-full border border-[#e2e8f0] bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoUrl}
                          alt={report.ticker}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-[9px] font-mono font-bold text-[#64748b]">
                          {report.ticker.slice(0, 2)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-[#0f172a] group-hover:text-blue-600 transition-colors truncate">
                          {displayName}
                        </span>
                        <span className="font-mono text-[11px] text-[#94a3b8] shrink-0">
                          {report.ticker}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748b] mt-0.5 font-mono">
                        {report.d || (isEn ? "Latest" : "최신")} · {report.verdict || (isEn ? "Evaluated" : "평가 완료")}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold font-mono">
                        {isEn ? `Buy: ${votesBuy}` : `찬성 ${votesBuy}표`}
                      </span>
                      {typeof report.upside_pct === "number" && (
                        <p className="text-[10px] text-emerald-600 font-mono mt-0.5">
                          {isEn ? "Upside " : "상승여력 "}{report.upside_pct > 0 ? `+${report.upside_pct.toFixed(0)}%` : `${report.upside_pct.toFixed(0)}%`}
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#cbd5e1] group-hover:text-[#0f172a] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-[#94a3b8] font-mono pt-2">
        <span>{isEn ? "* Automatically updated daily by our automated valuation pipeline." : "* 매일 밤 정기 밸류에이션 파이프라인에서 최신 데이터로 자동 업데이트됩니다."}</span>
        <span>{isEn ? "Source: Reportist 13 Guru Consensus Benchmark" : "출처: 리포티스트 13인 거장 합의 벤치마크"}</span>
      </div>
    </div>
  );
}
