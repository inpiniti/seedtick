"use client";

import React from "react";
import { MarkdownViewer } from "@/components/ui/MarkdownViewer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import {
  TrendingUp,
  ShieldCheck,
  BarChart3,
  DollarSign,
  PieChart,
  Lightbulb,
  Newspaper,
  ExternalLink,
} from "lucide-react";

interface ReportDatapackViewProps {
  datapack: Record<string, any> | string | null;
}

// 큰 숫자 포맷팅 (B = Billion, M = Million, T = Trillion, 천단위 콤마)
function formatLargeNumber(val: number | null | undefined, unit = "$"): string {
  if (val === null || val === undefined || isNaN(val)) return "-";
  const abs = Math.abs(val);
  const sign = val < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${unit}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${unit}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${unit}${(abs / 1e6).toFixed(2)}M`;
  return `${sign}${unit}${val.toLocaleString()}`;
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "-";
  return `${val.toFixed(2)}%`;
}

function formatRatio(val: number | null | undefined, suffix = "x"): string {
  if (val === null || val === undefined || isNaN(val)) return "-";
  return `${val.toFixed(2)}${suffix}`;
}

export function ReportDatapackView({ datapack }: ReportDatapackViewProps) {
  if (!datapack) {
    return (
      <EmptyState
        title="심층 데이터팩이 등록되지 않았어요"
        description="종목 분석 시 야후 파이낸스 및 공시 데이터가 수집되면 여기에 표시돼요."
      />
    );
  }

  // 데이터팩이 원시 마크다운 문자열인 경우
  if (typeof datapack === "string") {
    return <MarkdownViewer content={datapack} />;
  }

  const {
    overview,
    valuation,
    balance_sheet,
    income_annual,
    cashflow_annual,
    market_metrics,
    analyst_consensus,
    news_items,
    value_drivers,
  } = datapack;

  return (
    <div className="space-y-6 text-[#191f28]">
      {/* 1. 기업 개요 */}
      {overview && (
        <div className="p-4 rounded-2xl bg-[#f9fafb] border border-[#f2f4f6]">
          <h4 className="text-xs font-bold text-[#6b7684] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-[#3182f6]" />
            기업 개요 (Business Overview)
          </h4>
          <div className="text-xs leading-relaxed text-[#333d4b]">
            <MarkdownViewer content={overview} />
          </div>
        </div>
      )}

      {/* 2. 밸류에이션 하이라이트 */}
      {valuation && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#6b7684] uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[#3182f6]" />
            밸류에이션 지표 (Valuation)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">현재가</span>
              <span className="text-sm font-bold text-[#191f28]">
                {valuation.current_price ? `$${valuation.current_price.toLocaleString()}` : "-"}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">시가총액</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatLargeNumber(valuation.market_cap)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">Trailing PER</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatRatio(valuation.trailing_pe)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">Forward PER</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatRatio(valuation.forward_pe)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">PEG 배수</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatRatio(valuation.peg)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">PBR</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatRatio(valuation.pbr)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">EV / EBITDA</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatRatio(valuation.ev_ebitda)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">배당수익률</span>
              <span className="text-sm font-bold text-[#03b26c]">
                {formatPercent(valuation.dividend_yield_pct)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. 재무 안전성 & 수익성 */}
      {balance_sheet && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#6b7684] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#03b26c]" />
            재무 안전성 및 자본 효율성 (Financial Health & Margin)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">ROE (자기자본이익률)</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatPercent(balance_sheet.roe_pct)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">ROA (총자산이익률)</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatPercent(balance_sheet.roa_pct)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">유동비율 (Current Ratio)</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatRatio(balance_sheet.current_ratio)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">부채비율 (Debt / Equity)</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatPercent(balance_sheet.debt_ratio ? balance_sheet.debt_ratio * 100 : null)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">현금 및 단기금융자산</span>
              <span className="text-sm font-bold text-[#191f28]">
                {formatLargeNumber(balance_sheet.cash_and_investments)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#ffffff] border border-[#e5e8eb]">
              <span className="text-[11px] text-[#8b95a1] block">순부채 (Net Debt)</span>
              <span className={`text-sm font-bold ${(balance_sheet.net_debt || 0) <= 0 ? "text-[#03b26c]" : "text-[#f04452]"}`}>
                {balance_sheet.net_debt <= 0 ? "순현금 우위 " : ""}
                {formatLargeNumber(balance_sheet.net_debt)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. 연간 손익 요약 테이블 */}
      {Array.isArray(income_annual) && income_annual.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#6b7684] uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#3182f6]" />
            연간 손익 추이 (Annual Income Statement)
          </h4>
          <div className="overflow-x-auto rounded-2xl border border-[#e5e8eb]">
            <table className="w-full min-w-[560px] text-xs text-left">
              <thead className="bg-[#f9fafb] text-[#6b7684] font-semibold border-b border-[#e5e8eb]">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">연도</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">매출액</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">매출총이익률</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">영업이익</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">영업이익률</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">당기순이익</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">EPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2f4f6] bg-white">
                {income_annual.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-[#f9fafb]">
                    <td className="py-2.5 px-3 font-bold text-[#191f28] whitespace-nowrap">{row.year}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">{formatLargeNumber(row.revenue)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">{formatPercent(row.gross_margin_pct)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">{formatLargeNumber(row.operating_income)}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#3182f6] whitespace-nowrap tabular-nums">
                      {formatPercent(row.operating_margin_pct)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">{formatLargeNumber(row.net_income)}</td>
                    <td className="py-2.5 px-3 font-bold whitespace-nowrap tabular-nums">
                      {row.eps !== null && row.eps !== undefined ? `$${row.eps.toFixed(2)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. 시장 지표 & 애널리스트 컨센서스 */}
      {(market_metrics || analyst_consensus) && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#6b7684] uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#3182f6]" />
            시장 수급 및 애널리스트 컨센서스
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 시장 수급 */}
            {market_metrics && (
              <div className="p-3.5 rounded-2xl bg-[#ffffff] border border-[#e5e8eb] space-y-2">
                <span className="text-xs font-bold text-[#191f28] block">시장 가격 및 모멘텀</span>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(market_metrics).map(([k, v], mIdx) => (
                    <div key={mIdx} className="flex justify-between py-0.5 border-b border-[#f9fafb]">
                      <span className="text-[#8b95a1]">{k}</span>
                      <span className="font-semibold text-[#191f28]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 애널리스트 컨센서스 */}
            {analyst_consensus && (
              <div className="p-3.5 rounded-2xl bg-[#ffffff] border border-[#e5e8eb] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#191f28]">애널리스트 투자의견</span>
                  {analyst_consensus["의견"] && (
                    <Badge variant="primary" className="uppercase font-bold text-[10px]">
                      {String(analyst_consensus["의견"])}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5 text-xs">
                  {Object.entries(analyst_consensus).map(([k, v], cIdx) => {
                    if (k === "의견") return null;
                    return (
                      <div key={cIdx} className="flex justify-between py-0.5 border-b border-[#f9fafb]">
                        <span className="text-[#8b95a1]">{k}</span>
                        <span className="font-semibold text-[#191f28]">{String(v)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. 최신 뉴스 및 시장 이벤트 */}
      {Array.isArray(news_items) && news_items.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#6b7684] uppercase tracking-wider flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5 text-[#3182f6]" />
            최신 뉴스 및 시장 이벤트 (Catalysts)
          </h4>
          <div className="divide-y divide-[#f2f4f6] rounded-2xl border border-[#e5e8eb] overflow-hidden bg-white">
            {news_items.map((news: any, nIdx: number) => (
              <div key={nIdx} className="px-3.5 py-3 flex items-start gap-2.5 hover:bg-[#f9fafb] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#191f28] leading-snug">
                    {news.link ? (
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[#3182f6] transition-colors"
                      >
                        {news.title}
                      </a>
                    ) : (
                      news.title
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {news.publisher && (
                      <span className="text-[10px] text-[#8b95a1]">{news.publisher}</span>
                    )}
                    {news.published_at && (
                      <span className="text-[10px] text-[#c4c9d1]">{news.published_at}</span>
                    )}
                  </div>
                </div>
                {news.link && (
                  <a
                    href={news.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[#8b95a1] hover:text-[#3182f6] transition-colors mt-0.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. 핵심 가치 드라이버 (Value Drivers & Catalysts) */}
      {value_drivers && typeof value_drivers === "string" && value_drivers.trim() && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-[#1b64da] uppercase tracking-wider flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-[#3182f6]" />
            핵심 가치 드라이버 &amp; 촉매 분석 (Value Drivers)
          </h4>
          <div className="p-4 rounded-2xl bg-[#f0f7ff] border border-[#d0e5ff]">
            <MarkdownViewer content={value_drivers} />
          </div>
        </div>
      )}
    </div>
  );
}
