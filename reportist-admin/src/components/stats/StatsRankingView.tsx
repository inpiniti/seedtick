"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { GuruReportRow } from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import {
  Trophy,
  TrendingUp,
  AlertTriangle,
  Award,
  ChevronRight,
  BarChart3,
  Sparkles,
  PieChart,
} from "lucide-react";
import { formatPriceByNation } from "@/lib/utils";

interface StatsRankingViewProps {
  guruReports: GuruReportRow[];
  onSelectReport: (report: GuruReportRow) => void;
  tickerNameMap?: Record<string, string>;
}

type MarketFilter = "all" | "kr" | "us";

export function StatsRankingView({
  guruReports,
  onSelectReport,
  tickerNameMap = {},
}: StatsRankingViewProps) {
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");

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

  const getDisplayName = (report: GuruReportRow) => {
    const ticker = report.ticker.toUpperCase();
    return tickerNameMap[ticker] || report.company_name || ticker;
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── 1. 헤더 & 시장 전체 센티먼트 요약 카드 ── */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-slate-900" />
              <span>GURU CONSENSUS STATS HUB</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              13인 투자 거장 종합 표결 통계 랭킹
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              워런 버핏, 벤저민 그레이엄, 피터 린치 등 13인의 전설적 투자 거장 AI 에이전트의
              표결 데이터와 가치평가 점수를 바탕으로 산출한 실시간 통계 랭킹입니다.
            </p>
          </div>

          {/* 시장 필터 탭 */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-center">
            <button
              onClick={() => setMarketFilter("all")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                marketFilter === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              전체 종목 ({latestReports.length})
            </button>
            <button
              onClick={() => setMarketFilter("kr")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                marketFilter === "kr"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              국내 주식
            </button>
            <button
              onClick={() => setMarketFilter("us")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                marketFilter === "us"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              미국 주식
            </button>
          </div>
        </div>

        {/* 시장 전체 거장 센티먼트 게이지 바 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-slate-700" />
              <span>전체 시장 거장 심사 현황 ({marketSentiment.totalStocks}개 분석 종목)</span>
            </span>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-emerald-700">찬성 {marketSentiment.buyPct}%</span>
              <span className="text-amber-700">관망 {marketSentiment.watchPct}%</span>
              <span className="text-rose-700">매도 {marketSentiment.sellPct}%</span>
            </div>
          </div>

          {/* 비주얼 센티먼트 바 */}
          <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-slate-100 p-0.5 border border-slate-200">
            <div
              style={{ width: `${marketSentiment.buyPct}%` }}
              className="bg-emerald-500 rounded-l-full transition-all duration-500"
              title={`찬성 ${marketSentiment.buyPct}% (${marketSentiment.totalBuy}표)`}
            />
            <div
              style={{ width: `${marketSentiment.watchPct}%` }}
              className="bg-amber-400 transition-all duration-500"
              title={`관망 ${marketSentiment.watchPct}% (${marketSentiment.totalWatch}표)`}
            />
            <div
              style={{ width: `${marketSentiment.sellPct}%` }}
              className="bg-rose-500 rounded-r-full transition-all duration-500"
              title={`매도 ${marketSentiment.sellPct}% (${marketSentiment.totalSell}표)`}
            />
          </div>
          <p className="text-[11px] text-slate-500 text-right">
            * 13인의 거장 기준을 엄격히 통과한 종목 비율을 나타내며, 과열 구간에서는 관망 비율이 상승합니다.
          </p>
        </div>
      </header>

      {/* ── 2. 3대 핵심 랭킹 그리드 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 랭킹 1: 최다 찬성 종목 Top 10 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">거장 최다 찬성 순위</h2>
                <p className="text-[11px] text-emerald-800">13인 대가들이 적극 매수 표결한 종목</p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
              TOP 10
            </span>
          </div>

          <ul className="divide-y divide-slate-100 flex-1">
            {topBuyRanking.length === 0 ? (
              <li className="p-6 text-center text-xs text-slate-400">데이터를 불러오는 중입니다</li>
            ) : (
              topBuyRanking.map((report, idx) => {
                const displayName = getDisplayName(report);
                const votesBuy = report.votes_buy || 0;
                return (
                  <li key={report.ticker}>
                    <button
                      onClick={() => onSelectReport(report)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-5 text-center text-xs font-black ${
                            idx === 0
                              ? "text-amber-500"
                              : idx === 1
                              ? "text-slate-400"
                              : idx === 2
                              ? "text-amber-700"
                              : "text-slate-400"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                            {displayName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{report.ticker}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          찬성 {votesBuy}표
                        </span>
                        {typeof report.overall_score === "number" && report.overall_score > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {report.overall_score.toFixed(0)}점
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* 랭킹 2: 종합 가치평가 점수 Top 10 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">가치평가 종합 점수</h2>
                <p className="text-[11px] text-blue-800">재무 건전성 및 밸류에이션 총합 순위</p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
              TOP 10
            </span>
          </div>

          <ul className="divide-y divide-slate-100 flex-1">
            {topScoreRanking.length === 0 ? (
              <li className="p-6 text-center text-xs text-slate-400">데이터를 불러오는 중입니다</li>
            ) : (
              topScoreRanking.map((report, idx) => {
                const displayName = getDisplayName(report);
                const score = report.overall_score || 0;
                return (
                  <li key={report.ticker}>
                    <button
                      onClick={() => onSelectReport(report)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-5 text-center text-xs font-black ${
                            idx === 0
                              ? "text-blue-600"
                              : idx === 1
                              ? "text-blue-500"
                              : idx === 2
                              ? "text-blue-400"
                              : "text-slate-400"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                            {displayName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{report.ticker}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-900">
                          {score.toFixed(1)}
                          <span className="text-[10px] text-slate-400 font-normal"> / 100</span>
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">{report.verdict || "평가 완료"}</p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* 랭킹 3: 거장 주의/관망 경고 Top 10 */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">거장 주의/관망 경고</h2>
                <p className="text-[11px] text-amber-800">안전마진 부족으로 관망 표결이 쏟아진 종목</p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-amber-700 bg-white px-2 py-0.5 rounded-md border border-amber-200">
              CAUTION
            </span>
          </div>

          <ul className="divide-y divide-slate-100 flex-1">
            {topWatchRanking.length === 0 ? (
              <li className="p-6 text-center text-xs text-slate-400">데이터를 불러오는 중입니다</li>
            ) : (
              topWatchRanking.map((report, idx) => {
                const displayName = getDisplayName(report);
                const watchCount = (report.votes_watch || 0) + (report.votes_hold || 0);
                return (
                  <li key={report.ticker}>
                    <button
                      onClick={() => onSelectReport(report)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-center text-xs font-black text-slate-400">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-amber-700 transition-colors">
                            {displayName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{report.ticker}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                          관망 {watchCount}표
                        </span>
                        {typeof report.current_price === "number" && report.current_price > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {formatPriceByNation(report.current_price, undefined, report.ticker)}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {/* ── 3. 안내 푸터 ── */}
      <footer className="text-center pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
        <p>
          * 본 통계 랭킹은 13인의 전설적 투자 대가 AI 에이전트가 최신 재무제표와 공시 데이터를 독립 심사한 표결 합계입니다.
        </p>
        <p className="text-slate-400 text-[11px]">
          종목을 클릭하시면 거장별 상세 분석 리포트와 적정주가 산출 내역을 확인하실 수 있습니다.
        </p>
      </footer>
    </div>
  );
}
