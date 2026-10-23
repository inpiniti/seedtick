import React from "react";
import type { GuruReportRow } from "@/types/api";
import { formatPriceByNation } from "@/lib/utils";

interface StockStatsSummaryTableProps {
  displayName: string;
  ticker: string;
  publishedDate: string;
  report: GuruReportRow | null;
  lang?: "ko" | "en";
}

export function StockStatsSummaryTable({
  displayName,
  ticker,
  publishedDate,
  report,
  lang = "ko",
}: StockStatsSummaryTableProps) {
  if (!report) return null;

  const isEn = lang === "en";

  const votesBuy = typeof report.votes_buy === "number" ? report.votes_buy : 0;
  const votesWatch =
    (typeof report.votes_watch === "number" ? report.votes_watch : 0) +
    (typeof report.votes_hold === "number" ? report.votes_hold : 0);
  const votesSell = typeof report.votes_sell === "number" ? report.votes_sell : 0;
  const totalVotes = votesBuy + votesWatch + votesSell;

  const verdictMap: Record<string, string> = {
    매수: "BUY",
    보유: "HOLD",
    관망: "WATCH",
    매도: "SELL",
  };
  const rawVerdict = report.verdict || (isEn ? "ANALYZED" : "분석 완료");
  const verdict = isEn ? verdictMap[rawVerdict] || rawVerdict : rawVerdict;

  const isBuy = verdict === "매수" || verdict === "BUY";
  const isWatch =
    verdict.includes("관망") ||
    verdict.includes("보유") ||
    verdict === "WATCH" ||
    verdict === "HOLD";

  return (
    <section
      aria-label={
        isEn
          ? `${displayName} (${ticker}) stock forecast and guru valuation summary`
          : `${displayName} (${ticker}) 주가 전망 및 거장 표결 통계 요약`
      }
      className="w-full max-w-5xl mx-auto px-4 py-6"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <header className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isEn
                ? `${displayName} (${ticker}) Stock Forecast & 13 Guru Valuation Report`
                : `${displayName} (${ticker}) 주가 전망 및 13인 거장 가치평가 리포트`}
            </h1>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-md">
              {isEn ? "Analysis Date: " : "분석 기준일: "}
              {publishedDate || (isEn ? "Latest" : "최신")}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {isEn
              ? "Multi-agent AI valuation summary based on independent audits of corporate financials by 13 legendary value investors including Warren Buffett and Peter Lynch."
              : "워런 버핏, 벤저민 그레이엄, 피터 린치 등 13인의 전설적 투자 대가 AI 에이전트가 기업 재무 팩터를 독립 심사한 주가 전망과 적정 내재가치 표결 통계 요약입니다."}
          </p>
        </header>

        {/* AI 크롤러 및 검색 엔진을 위한 시맨틱 데이터 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <caption className="sr-only">
              {isEn
                ? `${displayName} 13 Guru Valuation & Forecast Key Metrics`
                : `${displayName} 13인 투자 거장 표결 현황 및 주가 전망·가치평가 핵심 지표`}
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-xs text-slate-600 font-semibold uppercase">
                <th scope="col" className="py-2.5 px-3">
                  {isEn ? "Metric" : "지표 항목"}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {isEn ? "Statistics / Result" : "통계 수치 / 결과"}
                </th>
                <th scope="col" className="py-2.5 px-3">
                  {isEn ? "Description" : "상세 설명"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <th scope="row" className="py-3 px-3 font-semibold text-slate-900">
                  {isEn ? "Consensus Verdict & Forecast" : "거장 종합 의견 및 전망"}
                </th>
                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      isBuy
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isWatch
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {verdict}
                  </span>
                </td>
                <td className="py-3 px-3 text-xs text-slate-500">
                  {isEn
                    ? "Consensus majority rule and margin-of-safety weighted outcome from 13 guru AI personas"
                    : "13인 거장 AI 에이전트 다수결 및 안전마진 가중 합의 결과"}
                </td>
              </tr>

              <tr>
                <th scope="row" className="py-3 px-3 font-semibold text-slate-900">
                  {isEn ? "13 Guru Vote Distribution" : "13인 거장 표결 분포"}
                </th>
                <td className="py-3 px-3 font-medium">
                  <span className="text-emerald-600 font-bold">
                    {isEn ? `Buy ${votesBuy}` : `찬성 ${votesBuy}명`}
                  </span>
                  <span className="text-slate-400 mx-1.5">/</span>
                  <span className="text-amber-600 font-bold">
                    {isEn ? `Watch ${votesWatch}` : `관망 ${votesWatch}명`}
                  </span>
                  <span className="text-slate-400 mx-1.5">/</span>
                  <span className="text-rose-600 font-bold">
                    {isEn ? `Sell ${votesSell}` : `매도 ${votesSell}명`}
                  </span>
                  {totalVotes > 0 && (
                    <span className="text-xs text-slate-400 ml-1.5 font-normal">
                      {isEn ? `(Total ${totalVotes} Gurus Audited)` : `(총 ${totalVotes}인 심사)`}
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-xs text-slate-500">
                  {isEn
                    ? "Votes based on each guru's distinct investment philosophy (economic moat, margin of safety, growth, etc.)"
                    : "각 거장의 투자 철학(해자·안전마진·성장성 등) 충족 여부 표결"}
                </td>
              </tr>

              {typeof report.overall_score === "number" && report.overall_score > 0 && (
                <tr>
                  <th scope="row" className="py-3 px-3 font-semibold text-slate-900">
                    {isEn ? "Overall Valuation Score" : "종합 가치평가 점수"}
                  </th>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {isEn
                      ? `${report.overall_score.toFixed(1)} / 100 pts`
                      : `${report.overall_score.toFixed(1)} / 100점`}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500">
                    {isEn
                      ? "Comprehensive score evaluating financial stability, valuation discount, and business durability"
                      : "재무 건전성, 밸류에이션 매력도, 지속 가능성을 종합한 스코어"}
                  </td>
                </tr>
              )}

              {typeof report.current_price === "number" && report.current_price > 0 && (
                <tr>
                  <th scope="row" className="py-3 px-3 font-semibold text-slate-900">
                    {isEn ? "Analysis Benchmark Price" : "분석 기준 주가"}
                  </th>
                  <td className="py-3 px-3 font-semibold text-slate-900 font-mono">
                    {formatPriceByNation(report.current_price, undefined, ticker)}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500">
                    {isEn
                      ? "Market price at the time of report publication"
                      : "리포트 발행 시점의 시장 기준 시세"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="mt-3 text-right">
          <p className="text-[11px] text-slate-400">
            {isEn
              ? "* All Reportist research is an independent valuation metric based on regulatory financial disclosures and does not constitute financial advice."
              : "* 리포티스트(Reportist)의 모든 분석은 공시 재무 데이터를 기반으로 한 독립 가치평가 지표이며 투자 권유가 아닙니다."}
          </p>
        </footer>
      </div>
    </section>
  );
}
