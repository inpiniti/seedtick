"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { GuruReportRow } from "@/types/api";
import {
  Trophy,
  Award,
  AlertTriangle,
  PieChart,
  BarChart2,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Layers,
  CheckCircle2,
  Grid,
  Calendar,
} from "lucide-react";
import { formatPriceByNation } from "@/lib/utils";
import { DataCache } from "@/lib/dataCache";
import { fetchTickerLogos } from "@/lib/api-client";
import {
  BenchmarkBarChart,
  BenchmarkChartItem,
} from "./BenchmarkBarChart";
import { BenchmarkScatterPlot } from "./BenchmarkScatterPlot";
import { BenchmarkTimelineChart } from "./BenchmarkTimelineChart";

interface StatsRankingViewProps {
  guruReports: GuruReportRow[];
  onSelectReport: (report: GuruReportRow) => void;
  tickerNameMap?: Record<string, string>;
}

type MarketFilter = "all" | "kr" | "us";
type ViewMode = "benchmark" | "table";
type SectionFilter = "all" | "scatter" | "timeline" | "consensus" | "margin" | "multiple";

export function StatsRankingView({
  guruReports,
  onSelectReport,
  tickerNameMap = {},
}: StatsRankingViewProps) {
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

  // ─────────────────────────────────────────────────────────────
  // 변별력 있는 3대 세로 막대 벤치마크 데이터
  // ─────────────────────────────────────────────────────────────

  // 1. 13인 거장 합의 찬성률 (Consensus Approval Rate %)
  const consensusRateItems = useMemo<BenchmarkChartItem[]>(() => {
    return [...filteredReports]
      .filter((r) => (r.votes_buy || 0) > 0)
      .map((r) => {
        const total =
          (r.votes_buy || 0) +
          (r.votes_watch || 0) +
          (r.votes_hold || 0) +
          (r.votes_sell || 0) || 13;
        const rate = Math.round(((r.votes_buy || 0) / total) * 100);
        return {
          ticker: r.ticker,
          name: getDisplayName(r),
          value: rate,
          displayValue: `${rate}%`,
          report: r,
          subText: `찬성 ${r.votes_buy || 0}표 / 전체 ${total}인`,
        };
      })
      .sort(
        (a, b) =>
          b.value - a.value || (b.report.votes_buy || 0) - (a.report.votes_buy || 0)
      )
      .slice(0, 20);
  }, [filteredReports]);

  // 2. 순수 안전마진율 벤치마크 (Margin of Safety / Upside %)
  const marginItems = useMemo<BenchmarkChartItem[]>(() => {
    return [...filteredReports]
      .map((r) => {
        let upside = 0;
        if (typeof r.upside_pct === "number") {
          upside = Math.round(r.upside_pct);
        } else if (r.fair_value && r.current_price && r.current_price > 0) {
          upside = Math.round(((r.fair_value - r.current_price) / r.current_price) * 100);
        }
        return {
          ticker: r.ticker,
          name: getDisplayName(r),
          value: Math.max(upside, 0),
          displayValue: upside > 0 ? `+${upside}%` : `${upside}%`,
          report: r,
          subText:
            r.current_price && r.fair_value
              ? `${formatPriceByNation(r.current_price, undefined, r.ticker)} → ${formatPriceByNation(
                  r.fair_value,
                  undefined,
                  r.ticker
                )}`
              : "적정주가 산정 완료",
        };
      })
      .filter((it) => it.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [filteredReports]);

  // 3. 적정주가 배율 벤치마크 (Fair Value Multiple - 몇 배 저평가인가)
  const multipleItems = useMemo<BenchmarkChartItem[]>(() => {
    return [...filteredReports]
      .map((r) => {
        let multiple = 1.0;
        if (r.fair_value && r.current_price && r.current_price > 0) {
          multiple = Number((r.fair_value / r.current_price).toFixed(2));
        } else if (typeof r.upside_pct === "number") {
          multiple = Number((1 + r.upside_pct / 100).toFixed(2));
        }
        return {
          ticker: r.ticker,
          name: getDisplayName(r),
          value: Math.round(multiple * 100),
          displayValue: `${multiple.toFixed(2)}배`,
          report: r,
          subText:
            r.current_price && r.fair_value
              ? `현재가 대비 적정가 ${multiple.toFixed(2)}배 수준`
              : "적정주가 밸류에이션",
        };
      })
      .filter((it) => it.value > 100) // 1배 이상 저평가 종목
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [filteredReports]);

  // 테이블 뷰용 리스트
  const topBuyRanking = useMemo(() => {
    return [...filteredReports]
      .filter((r) => (r.votes_buy || 0) > 0)
      .sort((a, b) => (b.votes_buy || 0) - (a.votes_buy || 0))
      .slice(0, 15);
  }, [filteredReports]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.68fr)_minmax(0,1.32fr)] gap-8 lg:gap-12">
      {/* ── 좌측: 리포티스트 시그니처 05 인덱스 + 설명 + 필터 + 거장 센티먼트 요약 ── */}
      <div className="space-y-4 md:sticky md:top-[72px] md:self-start">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-semibold text-[#94a3b8]">
            05
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
            거장 표결 통계 랭킹
          </h2>
        </div>

        <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-md">
          13인의 전설적 투자 대가 AI 에이전트의 표결 합산 데이터와 밸류에이션 수치를 집계한 다차원 벤치마크 허브입니다.
          Artificial Analysis 스타일의 4분면 매트릭스, 일자별 타임라인, 세로 막대그래프로 최우량 저평가 종목을 한눈에 비교하세요.
        </p>

        {/* 시장 필터 탭 */}
        <div className="pt-1 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setMarketFilter("all")}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded border transition-colors cursor-pointer ${
              marketFilter === "all"
                ? "bg-[#0f172a] text-white border-[#0f172a]"
                : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
            }`}
          >
            전체 ({latestReports.length})
          </button>
          <button
            onClick={() => setMarketFilter("kr")}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded border transition-colors cursor-pointer ${
              marketFilter === "kr"
                ? "bg-[#0f172a] text-white border-[#0f172a]"
                : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
            }`}
          >
            국내 주식 🇰🇷
          </button>
          <button
            onClick={() => setMarketFilter("us")}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded border transition-colors cursor-pointer ${
              marketFilter === "us"
                ? "bg-[#0f172a] text-white border-[#0f172a]"
                : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
            }`}
          >
            미국 주식 🇺🇸
          </button>

          {/* 뷰 모드 토글 (차트 ☵ vs 테이블 ☰) */}
          <div className="ml-auto flex items-center p-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc]">
            <button
              onClick={() => setViewMode("benchmark")}
              title="다차원 벤치마크 차트"
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "benchmark"
                  ? "bg-white text-[#0f172a] shadow-2xs font-semibold"
                  : "text-[#94a3b8] hover:text-[#64748b]"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="순위 리스트 테이블"
              className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-[#0f172a] shadow-2xs font-semibold"
                  : "text-[#94a3b8] hover:text-[#64748b]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 시장 전체 거장 센티먼트 요약 카드 */}
        <div className="p-4 rounded-md bg-[#f8fafc] border border-[#e2e8f0] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#0f172a] flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-[#0f172a]" />
              <span>시장 거장 심사 현황 ({marketSentiment.totalStocks}개 분석)</span>
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-emerald-700 font-semibold">찬성 {marketSentiment.buyPct}%</span>
            <span className="text-amber-700 font-semibold">관망 {marketSentiment.watchPct}%</span>
            <span className="text-rose-700 font-semibold">매도 {marketSentiment.sellPct}%</span>
          </div>

          <div className="w-full h-2 rounded-full overflow-hidden flex bg-[#e2e8f0]">
            <div style={{ width: `${marketSentiment.buyPct}%` }} className="bg-emerald-500" />
            <div style={{ width: `${marketSentiment.watchPct}%` }} className="bg-amber-400" />
            <div style={{ width: `${marketSentiment.sellPct}%` }} className="bg-rose-500" />
          </div>

          <p className="text-[11px] text-[#64748b] leading-snug">
            * 13인의 거장 기준을 엄격히 통과한 종목 비율이며, 고평가 구간에서는 관망 비율이 상승합니다.
          </p>
        </div>

        {/* 안내 팁 박스 */}
        <div className="p-3.5 rounded-md border border-emerald-100 bg-emerald-50/50 text-[11px] text-emerald-950 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Most Attractive Quadrant 안내</span>
          </div>
          4분면 산점도 매트릭스에서 우상단 초록색 박스(찬성률 45%↑ & 안전마진 15%↑)에 위치한 종목들이 13인 대가들이 인정한 최우량 저평가 종목군입니다.
        </div>
      </div>

      {/* ── 우측: 와이드 벤치마크 룸 (1행 1차트 레이아웃) ── */}
      <div className="min-w-0 space-y-6">
        {/* 상단 섹션 필터 태그 (Artificial Analysis 상단 태그바 스타일) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#e2e8f0] scrollbar-none">
          <button
            onClick={() => setSectionFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              sectionFilter === "all"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            전체 보기
          </button>
          <button
            onClick={() => setSectionFilter("scatter")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              sectionFilter === "scatter"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            4분면 산점도 매트릭스
          </button>
          <button
            onClick={() => setSectionFilter("timeline")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              sectionFilter === "timeline"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            일자별 시계열 추이
          </button>
          <button
            onClick={() => setSectionFilter("consensus")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              sectionFilter === "consensus"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            거장 찬성률 랭킹
          </button>
          <button
            onClick={() => setSectionFilter("margin")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              sectionFilter === "margin"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            안전마진율 랭킹
          </button>
          <button
            onClick={() => setSectionFilter("multiple")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              sectionFilter === "multiple"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            적정가 배수 랭킹
          </button>
        </div>

        {/* ── 뷰 모드 1: 1행 1차트 와이드 풀위드 벤치마크 ── */}
        {viewMode === "benchmark" && (
          <div className="space-y-6">
            {/* 1. [첨부 3번] 4분면 산점도 매트릭스 */}
            {(sectionFilter === "all" || sectionFilter === "scatter") && (
              <BenchmarkScatterPlot
                reports={filteredReports}
                onSelectReport={onSelectReport}
                tickerNameMap={tickerNameMap}
                logoMap={logoMap}
              />
            )}

            {/* 2. [첨부 4번] 일자별 시계열 추이 차트 */}
            {(sectionFilter === "all" || sectionFilter === "timeline") && (
              <BenchmarkTimelineChart
                onSelectReport={(r) => {
                  const ticker = (r.ticker || "").toUpperCase();
                  const found = latestReports.find(
                    (item) => item.ticker.toUpperCase() === ticker
                  );
                  if (found) {
                    onSelectReport(found);
                  } else {
                    onSelectReport({
                      ...r,
                      id: r.id || `${ticker}-${r.d || "latest"}`,
                      ticker,
                      overall_score: 0,
                      verdict: "분석 리포트",
                    } as GuruReportRow);
                  }
                }}
                tickerNameMap={tickerNameMap}
              />
            )}

            {/* 3. 13인 거장 합의 찬성률 (와이드 풀위드) */}
            {(sectionFilter === "all" || sectionFilter === "consensus") && (
              <BenchmarkBarChart
                title="13인 거장 합의 찬성률 벤치마크"
                subtitle="13인의 대가 중 매수/찬성 표결 합의 비율 (Top 20, %)"
                badge="업데이트됨"
                items={consensusRateItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}

            {/* 4. 순수 안전마진율 벤치마크 (와이드 풀위드) */}
            {(sectionFilter === "all" || sectionFilter === "margin") && (
              <BenchmarkBarChart
                title="순수 내재가치 안전마진율 벤치마크"
                subtitle="13인 거장 합의 적정주가 대비 현재가 상승여력 (Top 20, %)"
                items={marginItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}

            {/* 5. 적정주가 밸류에이션 갭 / 배율 벤치마크 (와이드 풀위드) */}
            {(sectionFilter === "all" || sectionFilter === "multiple") && (
              <BenchmarkBarChart
                title="적정주가 밸류에이션 배율 벤치마크"
                subtitle="현재 주가 대비 거장 합의 적정주가의 괴리 배수 (Top 20, 배)"
                items={multipleItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}
          </div>
        )}

        {/* ── 뷰 모드 2: 심플 순위 테이블 ── */}
        {viewMode === "table" && (
          <div className="border border-[#e2e8f0] rounded-md bg-white overflow-hidden shadow-xs divide-y divide-[#f1f5f9]">
            {topBuyRanking.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#94a3b8]">
                해당 조건의 분석 종목 데이터가 없습니다.
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
                          {report.d || "최신"} · {report.verdict || "평가 완료"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold font-mono">
                          찬성 {votesBuy}표
                        </span>
                        {typeof report.upside_pct === "number" && (
                          <p className="text-[10px] text-emerald-600 font-mono mt-0.5">
                            상승여력 {report.upside_pct > 0 ? `+${report.upside_pct.toFixed(0)}%` : `${report.upside_pct.toFixed(0)}%`}
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

        <div className="flex items-center justify-between text-[11px] text-[#94a3b8] font-mono pt-1">
          <span>* 매일 밤 정기 밸류에이션 파이프라인에서 최신 데이터로 자동 업데이트됩니다.</span>
          <span>출처: 리포티스트 13인 거장 합의 벤치마크</span>
        </div>
      </div>
    </div>
  );
}
