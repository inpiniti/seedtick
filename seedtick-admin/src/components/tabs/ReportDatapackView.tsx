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
        title="심층 데이터팩이 등록되지 않았습니다"
        description="종목 분석 시 수집된 재무, 밸류에이션, 사업 개요 원시 데이터팩이 여기에 아카이빙됩니다."
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
    market_metrics,
    analyst_consensus,
    news_items,
    value_drivers,
  } = datapack;

  return (
    <div className="space-y-6 text-[#0f172a] font-sans">
      {/* 1. 기업 개요 */}
      {overview && (
        <div className="p-4 rounded-md bg-[#f8fafc] border border-[#e2e8f0]">
          <h4 className="text-xs font-mono font-medium text-[#64748b] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PieChart className="w-3.5 h-3.5 text-[#0f172a]" />
            Business Overview
          </h4>
          <div className="text-xs leading-relaxed text-[#334155]">
            <MarkdownViewer content={overview} />
          </div>
        </div>
      )}

      {/* 2. 밸류에이션 하이라이트 */}
      {valuation && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-medium text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-[#0f172a]" />
            Valuation Metrics
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Current Price</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {valuation.current_price ? `$${valuation.current_price.toLocaleString()}` : "-"}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Market Cap</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatLargeNumber(valuation.market_cap)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Trailing P/E</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatRatio(valuation.trailing_pe)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Forward P/E</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatRatio(valuation.forward_pe)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">PEG Ratio</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatRatio(valuation.peg)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">PBR</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatRatio(valuation.pbr)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">EV / EBITDA</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatRatio(valuation.ev_ebitda)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Dividend Yield</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatPercent(valuation.dividend_yield_pct)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. 재무 안전성 & 수익성 */}
      {balance_sheet && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-medium text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0f172a]" />
            Financial Health & Capital Efficiency
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">ROE</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatPercent(balance_sheet.roe_pct)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">ROA</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatPercent(balance_sheet.roa_pct)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Current Ratio</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatRatio(balance_sheet.current_ratio)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Debt / Equity</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatPercent(balance_sheet.debt_ratio ? balance_sheet.debt_ratio * 100 : null)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Cash & ST Inv</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {formatLargeNumber(balance_sheet.cash_and_investments)}
              </span>
            </div>
            <div className="p-3 rounded-md bg-white border border-[#e2e8f0]">
              <span className="text-[11px] font-mono text-[#64748b] block">Net Debt</span>
              <span className="text-sm font-mono font-semibold text-[#0f172a]">
                {balance_sheet.net_debt <= 0 ? "Net Cash " : ""}
                {formatLargeNumber(balance_sheet.net_debt)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. 연간 손익 요약 테이블 */}
      {Array.isArray(income_annual) && income_annual.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-medium text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#0f172a]" />
            Annual Income Statement
          </h4>
          <div className="overflow-x-auto rounded-md border border-[#e2e8f0]">
            <table className="w-full min-w-[560px] text-xs font-mono text-left">
              <thead className="bg-[#f8fafc] text-[#64748b] font-medium border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-2 px-3 whitespace-nowrap">Year</th>
                  <th className="py-2 px-3 whitespace-nowrap">Revenue</th>
                  <th className="py-2 px-3 whitespace-nowrap">Gross Margin</th>
                  <th className="py-2 px-3 whitespace-nowrap">Op Income</th>
                  <th className="py-2 px-3 whitespace-nowrap">Op Margin</th>
                  <th className="py-2 px-3 whitespace-nowrap">Net Income</th>
                  <th className="py-2 px-3 whitespace-nowrap">EPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] bg-white">
                {income_annual.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-[#f8fafc]">
                    <td className="py-2 px-3 font-bold text-[#0f172a] whitespace-nowrap">{row.year}</td>
                    <td className="py-2 px-3 whitespace-nowrap tabular-nums">{formatLargeNumber(row.revenue)}</td>
                    <td className="py-2 px-3 whitespace-nowrap tabular-nums">{formatPercent(row.gross_margin_pct)}</td>
                    <td className="py-2 px-3 whitespace-nowrap tabular-nums">{formatLargeNumber(row.operating_income)}</td>
                    <td className="py-2 px-3 font-semibold text-[#0f172a] whitespace-nowrap tabular-nums">
                      {formatPercent(row.operating_margin_pct)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap tabular-nums">{formatLargeNumber(row.net_income)}</td>
                    <td className="py-2 px-3 font-semibold whitespace-nowrap tabular-nums">
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
          <h4 className="text-xs font-mono font-medium text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#0f172a]" />
            Market Metrics & Consensus
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
            {market_metrics && (
              <div className="p-3.5 rounded-md bg-white border border-[#e2e8f0] space-y-2">
                <span className="text-xs font-bold text-[#0f172a] block">Pricing & Momentum</span>
                <div className="space-y-1 text-xs">
                  {Object.entries(market_metrics).map(([k, v], mIdx) => (
                    <div key={mIdx} className="flex justify-between py-0.5 border-b border-[#f8fafc]">
                      <span className="text-[#64748b]">{k}</span>
                      <span className="font-semibold text-[#0f172a]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analyst_consensus && (
              <div className="p-3.5 rounded-md bg-white border border-[#e2e8f0] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0f172a]">Analyst Opinion</span>
                  {analyst_consensus["의견"] && (
                    <Badge variant="primary" className="uppercase font-bold text-[10px]">
                      {String(analyst_consensus["의견"])}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  {Object.entries(analyst_consensus).map(([k, v], cIdx) => {
                    if (k === "의견") return null;
                    return (
                      <div key={cIdx} className="flex justify-between py-0.5 border-b border-[#f8fafc]">
                        <span className="text-[#64748b]">{k}</span>
                        <span className="font-semibold text-[#0f172a]">{String(v)}</span>
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
          <h4 className="text-xs font-mono font-medium text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5 text-[#0f172a]" />
            Catalysts & Market News
          </h4>
          <div className="divide-y divide-[#f1f5f9] rounded-md border border-[#e2e8f0] overflow-hidden bg-white">
            {news_items.map((news: any, nIdx: number) => (
              <div key={nIdx} className="px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-[#f8fafc] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0f172a] leading-snug">
                    {news.link ? (
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-black hover:underline transition-colors"
                      >
                        {news.title}
                      </a>
                    ) : (
                      news.title
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 font-mono">
                    {news.publisher && (
                      <span className="text-[10px] text-[#64748b]">{news.publisher}</span>
                    )}
                    {news.published_at && (
                      <span className="text-[10px] text-[#94a3b8]">{news.published_at}</span>
                    )}
                  </div>
                </div>
                {news.link && (
                  <a
                    href={news.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[#64748b] hover:text-[#0f172a] transition-colors mt-0.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. 핵심 가치 드라이버 */}
      {value_drivers && typeof value_drivers === "string" && value_drivers.trim() && (
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-medium text-[#0f172a] uppercase tracking-wider flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-[#0f172a]" />
            Key Value Drivers
          </h4>
          <div className="p-4 rounded-md bg-[#f8fafc] border border-[#e2e8f0]">
            <MarkdownViewer content={value_drivers} />
          </div>
        </div>
      )}
    </div>
  );
}
