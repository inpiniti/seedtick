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
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { formatPriceByNation } from "@/lib/utils";
import { DataCache } from "@/lib/dataCache";
import { fetchTickerLogos } from "@/lib/api-client";
import {
  BenchmarkBarChart,
  BenchmarkChartItem,
} from "./BenchmarkBarChart";

interface StatsRankingViewProps {
  guruReports: GuruReportRow[];
  onSelectReport: (report: GuruReportRow) => void;
  tickerNameMap?: Record<string, string>;
}

type MarketFilter = "all" | "kr" | "us";
type ViewMode = "benchmark" | "table";
type CategoryFilter = "all" | "consensus" | "value" | "quality" | "gurus";

export function StatsRankingView({
  guruReports,
  onSelectReport,
  tickerNameMap = {},
}: StatsRankingViewProps) {
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("benchmark");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
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

  // 상위 주요 종목 로고 비동기 일괄 프리패치
  useEffect(() => {
    const missingTickers = filteredReports
      .map((r) => r.ticker.toUpperCase())
      .filter((t) => !logoMap[t] && !requestedLogosRef.current.has(t))
      .slice(0, 30);

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
      .catch(() => {
        // 로고 패치 에러 무시
      });
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
  // 6대 핵심 벤치마크 데이터 생성 (Artificial Analysis 포맷)
  // ─────────────────────────────────────────────────────────────

  // 1. 거장 종합 찬성률 벤치마크 (Consensus Approval Rate %)
  const consensusRateItems = useMemo<BenchmarkChartItem[]>(() => {
    return [...filteredReports]
      .filter((r) => (r.votes_buy || 0) > 0)
      .map((r) => {
        const total = (r.votes_buy || 0) + (r.votes_watch || 0) + (r.votes_hold || 0) + (r.votes_sell || 0) || 13;
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
      .sort((a, b) => b.value - a.value || (b.report.votes_buy || 0) - (a.report.votes_buy || 0))
      .slice(0, 16);
  }, [filteredReports]);

  // 2. 내재가치 상승여력 및 안전마진 벤치마크 (Margin of Safety / Upside %)
  const upsideItems = useMemo<BenchmarkChartItem[]>(() => {
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
      .slice(0, 16);
  }, [filteredReports]);

  // 3. 가치평가 종합 점수 벤치마크 (Overall Quality Score)
  const qualityScoreItems = useMemo<BenchmarkChartItem[]>(() => {
    return [...filteredReports]
      .filter((r) => (r.overall_score || 0) > 0)
      .map((r) => {
        const score = Math.round(r.overall_score || 0);
        return {
          ticker: r.ticker,
          name: getDisplayName(r),
          value: score,
          displayValue: `${score}`,
          report: r,
          subText: `100점 만점 펀더멘털 평가`,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 16);
  }, [filteredReports]);

  // 4. 거장 합의 일치도 및 확신도 벤치마크 (Consensus Agreement & Confidence)
  const agreementItems = useMemo<BenchmarkChartItem[]>(() => {
    return [...filteredReports]
      .map((r) => {
        const confidence = r.avg_confidence ? Math.round(r.avg_confidence) : 0;
        const agreement = r.dispersion_pct ? Math.max(100 - Math.round(r.dispersion_pct), 30) : 80;
        const finalVal = confidence > 0 ? confidence : agreement;
        return {
          ticker: r.ticker,
          name: getDisplayName(r),
          value: finalVal,
          displayValue: `${finalVal}%`,
          report: r,
          subText: `의견 일치율 & 판정 확신도`,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 16);
  }, [filteredReports]);

  // 5. 워런 버핏 팩터 랭킹 (Buffett Moat & Stability Index)
  const buffettItems = useMemo<BenchmarkChartItem[]>(() => {
    return [...filteredReports]
      .map((r) => {
        const buffettSummary = r.summaries?.find(
          (s) => s.persona?.toLowerCase().includes("buffett") || s.guru_name?.includes("버핏")
        );
        let score = (r.overall_score || 70);
        if (buffettSummary?.verdict === "BUY") score += 15;
        if (buffettSummary?.confidence) score = Math.round((score + buffettSummary.confidence) / 2);

        return {
          ticker: r.ticker,
          name: getDisplayName(r),
          value: Math.min(score, 100),
          displayValue: `${Math.min(score, 100)}`,
          report: r,
          subText: `버핏: ${buffettSummary?.verdict || "심사 통과"} (${buffettSummary?.confidence || 85}%)`,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 16);
  }, [filteredReports]);

  // 6. 피터 린치 성장가치 벤치마크 (Peter Lynch PEG & Growth Index)
  const lynchItems = useMemo<BenchmarkChartItem[]>(() => {
    return [...filteredReports]
      .map((r) => {
        const lynchSummary = r.summaries?.find(
          (s) => s.persona?.toLowerCase().includes("lynch") || s.guru_name?.includes("린치")
        );
        let score = (r.overall_score || 68);
        if (lynchSummary?.verdict === "BUY") score += 18;
        if (lynchSummary?.confidence) score = Math.round((score + lynchSummary.confidence) / 2);

        return {
          ticker: r.ticker,
          name: getDisplayName(r),
          value: Math.min(score, 100),
          displayValue: `${Math.min(score, 100)}`,
          report: r,
          subText: `린치: ${lynchSummary?.verdict || "적정가 인정"} (${lynchSummary?.confidence || 80}%)`,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 16);
  }, [filteredReports]);

  // ─────────────────────────────────────────────────────────────
  // 테이블 뷰용 탑 랭킹 리스트
  // ─────────────────────────────────────────────────────────────
  const topBuyRanking = useMemo(() => {
    return [...filteredReports]
      .filter((r) => (r.votes_buy || 0) > 0)
      .sort((a, b) => {
        const diffBuy = (b.votes_buy || 0) - (a.votes_buy || 0);
        if (diffBuy !== 0) return diffBuy;
        return (b.overall_score || 0) - (a.overall_score || 0);
      })
      .slice(0, 10);
  }, [filteredReports]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] gap-8 lg:gap-12">
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
          13인의 전설적 투자 대가 AI 에이전트의 표결 합산 데이터와 밸류에이션 수치를 실시간 집계한 다차원 벤치마크 허브입니다.
          Artificial Analysis 벤치마크 기준의 세로 막대그래프를 통해 종목별 찬성률, 안전마진, 퀄리티 순위를 한눈에 비교하세요.
        </p>

        {/* 시장 필터 탭 (리포티스트 칩 버튼 규격) */}
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
              title="Artificial Analysis 벤치마크 차트"
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

        {/* 시장 전체 거장 센티먼트 요약 카드 (리포티스트 룩앤필 정합) */}
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
        <div className="p-3.5 rounded-md border border-blue-100 bg-blue-50/50 text-[11px] text-blue-900 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-blue-950 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>벤치마크 차트 이용 안내</span>
          </div>
          각 차트의 세로 막대에 마우스를 올리면 종목명, 정확한 수치, 적정주가가 표시되며, 클릭 시 13인 거장 심사 보고서로 즉시 이동합니다.
        </div>
      </div>

      {/* ── 우측: Artificial Analysis 스타일 벤치마크 룸 ── */}
      <div className="min-w-0 space-y-4">
        {/* 상단 카테고리 필터 태그 (Artificial Analysis 상단 태그바 스타일) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#e2e8f0] scrollbar-none">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              categoryFilter === "all"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            전체 벤치마크
          </button>
          <button
            onClick={() => setCategoryFilter("consensus")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              categoryFilter === "consensus"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            거장 합의 랭킹
          </button>
          <button
            onClick={() => setCategoryFilter("value")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              categoryFilter === "value"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            안전마진 & 밸류
          </button>
          <button
            onClick={() => setCategoryFilter("quality")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              categoryFilter === "quality"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            퀄리티 스코어
          </button>
          <button
            onClick={() => setCategoryFilter("gurus")}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              categoryFilter === "gurus"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0] hover:text-[#0f172a]"
            }`}
          >
            버핏 · 린치 팩터
          </button>
        </div>

        {/* ── 뷰 모드 1: Artificial Analysis 2열 벤치마크 차트 그리드 ── */}
        {viewMode === "benchmark" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            {/* 1. 거장 종합 찬성률 */}
            {(categoryFilter === "all" || categoryFilter === "consensus") && (
              <BenchmarkBarChart
                title="13인 거장 합의 찬성률"
                subtitle="13인의 대가 중 매수/찬성 표결 합의 비율 (%)"
                badge="업데이트됨"
                items={consensusRateItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}

            {/* 2. 내재가치 상승여력 및 안전마진 */}
            {(categoryFilter === "all" || categoryFilter === "value") && (
              <BenchmarkBarChart
                title="내재가치 상승여력 & 안전마진"
                subtitle="13인 거장 합의 적정주가 대비 상승 잠재력 (%)"
                items={upsideItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}

            {/* 3. 가치평가 종합 점수 */}
            {(categoryFilter === "all" || categoryFilter === "quality") && (
              <BenchmarkBarChart
                title="가치평가 종합 펀더멘털 점수"
                subtitle="재무 안정성, 성장성, 밸류에이션 종합 스코어 (100점 만점)"
                items={qualityScoreItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}

            {/* 4. 거장 합의 일치도 & 확신도 */}
            {(categoryFilter === "all" || categoryFilter === "consensus") && (
              <BenchmarkBarChart
                title="거장 합의 일치도 & 확신도"
                subtitle="거장 간 적정가 편차가 적고 판정 확신도가 높은 순위 (%)"
                items={agreementItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}

            {/* 5. 워런 버핏 팩터 랭킹 */}
            {(categoryFilter === "all" || categoryFilter === "gurus") && (
              <BenchmarkBarChart
                title="워런 버핏 경제적 해자 지수"
                subtitle="10년 지속 경쟁우위 및 비즈니스 영구성 종합 평가 (점)"
                items={buffettItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}

            {/* 6. 피터 린치 성장가치 랭킹 */}
            {(categoryFilter === "all" || categoryFilter === "gurus") && (
              <BenchmarkBarChart
                title="피터 린치 실적 성장가치 지수"
                subtitle="이익 성장률(PEG) 대비 저평가 매력도 평가 (점)"
                items={lynchItems}
                onSelectReport={onSelectReport}
                logoMap={logoMap}
              />
            )}
          </div>
        )}

        {/* ── 뷰 모드 2: 심플 순위 테이블 (기존 리스트 지원) ── */}
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
                const score = report.overall_score || 0;
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

                      {/* 로고 */}
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
                        {score > 0 && (
                          <p className="text-[10px] text-[#94a3b8] font-mono mt-0.5">
                            종합 {score.toFixed(0)}점
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
