"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { GuruReportRow } from "@/types/api";
import {
  Trophy,
  Award,
  AlertTriangle,
  PieChart,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { formatPriceByNation } from "@/lib/utils";

interface StatsRankingViewProps {
  guruReports: GuruReportRow[];
  onSelectReport: (report: GuruReportRow) => void;
  tickerNameMap?: Record<string, string>;
}

type MarketFilter = "all" | "kr" | "us";
type RankingCategory = "buy" | "score" | "watch";

export function StatsRankingView({
  guruReports,
  onSelectReport,
  tickerNameMap = {},
}: StatsRankingViewProps) {
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [activeCategory, setActiveCategory] = useState<RankingCategory>("buy");

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

  // 1. 거장 최다 찬성 랭킹 Top 10
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

  // 2. 가치평가 종합 점수 랭킹 Top 10
  const topScoreRanking = useMemo(() => {
    return [...filteredReports]
      .filter((r) => (r.overall_score || 0) > 0)
      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
      .slice(0, 10);
  }, [filteredReports]);

  // 3. 거장 주의/관망 경고 랭킹 Top 10
  const topWatchRanking = useMemo(() => {
    return [...filteredReports]
      .filter((r) => {
        const watch = (r.votes_watch || 0) + (r.votes_hold || 0);
        return watch >= 8; // 13인 중 8인 이상 관망
      })
      .sort((a, b) => {
        const aWatch = (a.votes_watch || 0) + (a.votes_hold || 0);
        const bWatch = (b.votes_watch || 0) + (b.votes_hold || 0);
        return bWatch - aWatch;
      })
      .slice(0, 10);
  }, [filteredReports]);

  const currentRankingList = useMemo(() => {
    if (activeCategory === "buy") return topBuyRanking;
    if (activeCategory === "score") return topScoreRanking;
    return topWatchRanking;
  }, [activeCategory, topBuyRanking, topScoreRanking, topWatchRanking]);

  const getDisplayName = (report: GuruReportRow) => {
    const ticker = report.ticker.toUpperCase();
    return tickerNameMap[ticker] || report.company_name || ticker;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-8 lg:gap-12">
      {/* ── 좌측: 리포티스트 시그니처 인덱스 05 + 타이틀 + 설명 & 요약 게이지 ── */}
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
          13인의 전설적 투자 대가 AI 에이전트의 표결 합산 데이터와 밸류에이션 점수를 실시간 집계한 통계 허브입니다.
          대가들의 합의가 가장 높은 우량주와 과열 주의 종목 순위를 확인하세요.
        </p>

        {/* 시장 필터 탭 (리포티스트 칩 버튼 규격) */}
        <div className="pt-1 flex flex-wrap gap-1.5">
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
            국내 주식
          </button>
          <button
            onClick={() => setMarketFilter("us")}
            className={`px-2.5 py-1 text-xs font-mono font-medium rounded border transition-colors cursor-pointer ${
              marketFilter === "us"
                ? "bg-[#0f172a] text-white border-[#0f172a]"
                : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#94a3b8]"
            }`}
          >
            미국 주식
          </button>
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
      </div>

      {/* ── 우측: 랭킹 카테고리 탭 & 랭킹 리스트 ── */}
      <div className="min-w-0 space-y-4">
        {/* 랭킹 탭 선택 바 */}
        <div className="flex items-center gap-1.5 border-b border-[#e2e8f0] pb-3">
          <button
            onClick={() => setActiveCategory("buy")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeCategory === "buy"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>최다 찬성 순위 Top 10</span>
          </button>

          <button
            onClick={() => setActiveCategory("score")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeCategory === "score"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>종합 가치평가 점수 Top 10</span>
          </button>

          <button
            onClick={() => setActiveCategory("watch")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeCategory === "watch"
                ? "bg-[#0f172a] text-white"
                : "bg-[#f8fafc] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>거장 주의/관망 경고</span>
          </button>
        </div>

        {/* 랭킹 리스트 박스 (리포티스트 표준 카드 규격) */}
        <div className="border border-[#e2e8f0] rounded-md bg-white overflow-hidden shadow-xs divide-y divide-[#f1f5f9]">
          {currentRankingList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#94a3b8]">
              해당 조건의 분석 종목 데이터가 없습니다.
            </div>
          ) : (
            currentRankingList.map((report, idx) => {
              const displayName = getDisplayName(report);
              const votesBuy = report.votes_buy || 0;
              const watchCount = (report.votes_watch || 0) + (report.votes_hold || 0);
              const score = report.overall_score || 0;

              return (
                <button
                  key={report.ticker}
                  onClick={() => onSelectReport(report)}
                  className="w-full px-4 py-3.5 text-left hover:bg-[#f8fafc] transition-colors flex items-center justify-between gap-4 group cursor-pointer"
                >
                  {/* 순위 & 종목 정보 */}
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

                  {/* 지표 결과 뱃지 */}
                  <div className="text-right shrink-0 flex items-center gap-3">
                    {activeCategory === "buy" && (
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
                    )}

                    {activeCategory === "score" && (
                      <div className="text-right">
                        <span className="font-mono text-xs sm:text-sm font-bold text-[#0f172a]">
                          {score.toFixed(1)}
                          <span className="text-[10px] text-[#94a3b8] font-normal"> / 100</span>
                        </span>
                        <p className="text-[10px] text-emerald-700 font-mono mt-0.5">
                          찬성 {votesBuy}표
                        </p>
                      </div>
                    )}

                    {activeCategory === "watch" && (
                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold font-mono">
                          관망 {watchCount}표
                        </span>
                        {typeof report.current_price === "number" && report.current_price > 0 && (
                          <p className="text-[10px] text-[#94a3b8] font-mono mt-0.5">
                            {formatPriceByNation(report.current_price, undefined, report.ticker)}
                          </p>
                        )}
                      </div>
                    )}

                    <ChevronRight className="w-4 h-4 text-[#cbd5e1] group-hover:text-[#0f172a] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <p className="text-right text-[11px] text-[#94a3b8] font-mono">
          * 종목 클릭 시 13인 거장별 상세 심사 보고서와 적정주가 계산 내역으로 이동합니다.
        </p>
      </div>
    </div>
  );
}
