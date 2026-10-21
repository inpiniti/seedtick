import React from "react";
import type { GuruReportRow } from "@/types/api";

interface StockStatsSummaryTableProps {
  displayName: string;
  ticker: string;
  publishedDate: string;
  report: GuruReportRow | null;
}

export function StockStatsSummaryTable({
  displayName,
  ticker,
  publishedDate,
  report,
}: StockStatsSummaryTableProps) {
  if (!report) return null;

  const votesBuy = typeof report.votes_buy === "number" ? report.votes_buy : 0;
  const votesWatch =
    (typeof report.votes_watch === "number" ? report.votes_watch : 0) +
    (typeof report.votes_hold === "number" ? report.votes_hold : 0);
  const votesSell = typeof report.votes_sell === "number" ? report.votes_sell : 0;
  const totalVotes = votesBuy + votesWatch + votesSell;

  const verdict = report.verdict || "분석 완료";

  return (
    <section
      aria-label={`${displayName} 가치평가 및 거장 표결 통계 요약`}
      className="w-full max-w-5xl mx-auto px-4 py-6"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <header className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {displayName} ({ticker}) 가치평가 및 거장 표결 리포트
            </h1>
            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-md">
              분석 기준일: {publishedDate || "최신"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            워런 버핏, 벤저민 그레이엄, 피터 린치 등 13인의 전설적 투자 대가 AI 에이전트가
            기업 재무 팩터를 독립 심사한 표결 통계 요약입니다.
          </p>
        </header>

        {/* AI 크롤러 및 검색 엔진을 위한 시맨틱 데이터 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <caption className="sr-only">
              {displayName} 13인 투자 거장 표결 현황 및 핵심 가치평가 지표
            </caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-xs text-slate-600 font-semibold uppercase">
                <th scope="col" className="py-2.5 px-3">
                  지표 항목
                </th>
                <th scope="col" className="py-2.5 px-3">
                  통계 수치 / 결과
                </th>
                <th scope="col" className="py-2.5 px-3">
                  상세 설명
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <th scope="row" className="py-3 px-3 font-semibold text-slate-900">
                  거장 종합 의견
                </th>
                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      verdict.includes("매수")
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : verdict.includes("관망")
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {verdict}
                  </span>
                </td>
                <td className="py-3 px-3 text-xs text-slate-500">
                  13인 거장 AI 에이전트 다수결 및 안전마진 가중 합의 결과
                </td>
              </tr>

              <tr>
                <th scope="row" className="py-3 px-3 font-semibold text-slate-900">
                  13인 거장 표결 분포
                </th>
                <td className="py-3 px-3 font-medium">
                  <span className="text-emerald-600 font-bold">찬성 {votesBuy}명</span>
                  <span className="text-slate-400 mx-1.5">/</span>
                  <span className="text-amber-600 font-bold">관망 {votesWatch}명</span>
                  <span className="text-slate-400 mx-1.5">/</span>
                  <span className="text-rose-600 font-bold">매도 {votesSell}명</span>
                  {totalVotes > 0 && (
                    <span className="text-xs text-slate-400 ml-1.5 font-normal">
                      (총 {totalVotes}인 심사)
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-xs text-slate-500">
                  각 거장의 투자 철학(해자·안전마진·성장성 등) 충족 여부 표결
                </td>
              </tr>

              {typeof report.overall_score === "number" && report.overall_score > 0 && (
                <tr>
                  <th scope="row" className="py-3 px-3 font-semibold text-slate-900">
                    종합 가치평가 점수
                  </th>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {report.overall_score.toFixed(1)} / 100점
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500">
                    재무 건전성, 밸류에이션 매력도, 지속 가능성을 종합한 스코어
                  </td>
                </tr>
              )}

              {typeof report.current_price === "number" && report.current_price > 0 && (
                <tr>
                  <th scope="row" className="py-3 px-3 font-semibold text-slate-900">
                    분석 기준 주가
                  </th>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {report.current_price.toLocaleString()}원
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500">
                    리포트 발행 시점의 시장 기준 시세
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="mt-3 text-right">
          <p className="text-[11px] text-slate-400">
            * 리포티스트(Reportist)의 모든 분석은 공시 재무 데이터를 기반으로 한 독립 가치평가 지표이며 투자 권유가 아닙니다.
          </p>
        </footer>
      </div>
    </section>
  );
}
