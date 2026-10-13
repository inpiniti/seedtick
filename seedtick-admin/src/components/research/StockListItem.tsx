"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import {
  formatPercentB,
  formatIntrinsicRatio,
  IntrinsicStability,
} from "@/lib/insightUtils";
import { formatPriceByNation } from "@/lib/utils";

// ── 지표 뱃지 (공통) ─────────────────────────────────────

const MetricBadge: React.FC<{
  label: string;
  value: React.ReactNode;
  title?: string;
  highlight?: boolean;
}> = ({ label, value, title, highlight }) => (
  <span
    title={title}
    className={
      highlight
        ? "px-1.5 py-0.5 rounded border border-[#0f172a] bg-[#0f172a] text-white font-mono text-[11px]"
        : "px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-white text-[#475569] font-mono text-[11px]"
    }
  >
    {label}:{" "}
    <strong className={highlight ? "font-bold" : "text-[#0f172a]"}>
      {value}
    </strong>
  </span>
);

// ── 안정성 뱃지 ──────────────────────────────────────────

const STABILITY_BADGE_TITLE =
  "과거 보고서 가격의 분산입니다. 분석일별 입력 데이터의 차이는 분리하지 않습니다.";

const STABILITY_STYLES: Record<string, string> = {
  stable:
    "font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-white border border-slate-900",
  watch:
    "font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300",
  unstable:
    "font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-900 border border-slate-400 font-semibold",
};

const STABILITY_LABELS: Record<string, string> = {
  stable: "과거 가격 안정성: 안정",
  watch: "과거 가격 안정성: 주의",
  unstable: "과거 가격 안정성: 불안정",
};

function StabilityBadge({ stability }: { stability: IntrinsicStability }) {
  const style =
    STABILITY_STYLES[stability.level] ||
    "font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200";
  const label =
    STABILITY_LABELS[stability.level] || "과거 가격 안정성: 표본 부족";
  return (
    <span title={STABILITY_BADGE_TITLE} className={style}>
      {label}
    </span>
  );
}

// ── 투자의견 뱃지 ────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict?: string | null }) {
  if (!verdict) {
    return (
      <span className="font-mono text-[11px] px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
        대기 중
      </span>
    );
  }
  const lower = verdict.toLowerCase();
  if (lower.includes("매수") || lower.includes("buy")) {
    return (
      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#0f172a] text-white border border-[#0f172a] shrink-0">
        {verdict}
      </span>
    );
  }
  if (lower.includes("매도") || lower.includes("sell")) {
    return (
      <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-white text-[#0f172a] border border-[#64748b] shrink-0">
        {verdict}
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] shrink-0">
      {verdict}
    </span>
  );
}

// ── 공통 Insight 결과 인터페이스 ─────────────────────────

export interface StockItemInsight {
  verdict?: string | null;
  confidence?: number | null;
  fairValue?: number | null;
  intrinsicRatioPct?: number | null;
  safetyRatioPct?: number | null;
  intrinsicStability: IntrinsicStability;
  /** 리포트가 존재하지만 적정가가 null인 경우 true */
  fairValueDeferred?: boolean;
  dispersionPct?: number | null;
  priceEstimateCount?: number | null;
  voteAgreementPct?: number | null;
  safetyPrice?: string | null;
}

// ── StockListItem Props ─────────────────────────────────

export interface StockListItemProps {
  ticker: string;
  companyName: string;
  /** 로고 ReactNode (renderLogo 결과를 그대로 전달) */
  logo: React.ReactNode;
  /** 분석 insight (getInsight 결과) */
  insight: StockItemInsight;
  /** %B 값 */
  percentB?: number | null;
  /** 클릭 핸들러 */
  onClick: () => void;

  // ── 상단 라인 고유 뱃지들 (ReactNode 배열) ──
  /** 티커 앞에 붙는 접두어 (예: "#1") */
  rankPrefix?: string;
  /** 상단 라인에 추가로 보여줄 뱃지들 (투자의견 뱃지 앞) */
  badges?: React.ReactNode;

  // ── 지표 라인 관련 ──
  /** 현재 주가 표시 텍스트 (예: "$541.15") */
  priceText?: string;
  /** 변동률 (예: -1.09) */
  changeRate?: number | null;
  /** 시가총액 표시 텍스트 */
  marketCapText?: string;
  /** 추가 기본 지표 뱃지 (ROE, 영업익, 부채 등) */
  extraMetrics?: React.ReactNode;

  // ── 리포트 전용 ──
  /** 하단 요약 텍스트 */
  summary?: string | null;

  // ── 지연 로딩용 행 옵저버 ──
  /** IntersectionObserver 연결용 li ref 콜백 */
  rowRef?: (el: HTMLLIElement | null) => void;
  /** 옵저버 식별용 티커 키 (chartTickerKey 결과) */
  rowKey?: string;
}

// ── 메인 컴포넌트 ────────────────────────────────────────

export function StockListItem({
  ticker,
  companyName,
  logo,
  insight,
  percentB,
  onClick,
  rankPrefix,
  badges,
  priceText,
  changeRate,
  marketCapText,
  extraMetrics,
  summary,
  rowRef,
  rowKey,
}: StockListItemProps) {
  const ratioText = formatIntrinsicRatio(insight.intrinsicRatioPct ?? null);
  const safetyRatioText = formatIntrinsicRatio(insight.safetyRatioPct ?? null);

  return (
    <li ref={rowRef} data-pb-ticker={rowKey ?? ticker}>
      <div
        onClick={onClick}
        className="py-3.5 px-3 -mx-3 rounded-md hover:bg-[#f8fafc] transition-colors cursor-pointer group flex items-start gap-3.5 justify-between"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {logo}

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* ── 상단 라인: 티커, 회사명, 뱃지들, 투자의견 ── */}
            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
              <span className="font-bold text-[#0f172a] group-hover:text-black transition-colors">
                {rankPrefix ? `${rankPrefix} ` : ""}
                {ticker}
              </span>
              {companyName && companyName.toUpperCase() !== ticker.toUpperCase() && (
                <span className="text-[#64748b] truncate max-w-[200px]">
                  {companyName}
                </span>
              )}
              {badges}
              <VerdictBadge verdict={insight.verdict} />
            </div>

            {/* ── 지표 라인 ── */}
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
              {priceText && (
                <span className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-white text-[#0f172a] font-semibold">
                  PRICE: {priceText}
                  {changeRate != null && (
                    <span className="ml-1 text-[#64748b] font-normal">
                      ({changeRate >= 0 ? "+" : ""}
                      {changeRate.toFixed(2)}%)
                    </span>
                  )}
                </span>
              )}

              {marketCapText && (
                <span className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-white text-[#64748b]">
                  시총: {marketCapText}
                </span>
              )}

              {/* %B는 로딩중/실패도 뱃지 유지 (계산 중/-) */}
              <MetricBadge
                label="%B"
                value={formatPercentB(percentB)}
                title={
                  percentB === undefined
                    ? "볼린저 밴드 위치를 불러오는 중입니다. 행이 화면에 보이면 자동 조회합니다."
                    : percentB === null
                      ? "차트 조회 실패 또는 데이터 부족(20봉 미만)으로 %B를 계산하지 못했습니다."
                      : "볼린저 밴드 위치 (%B = (현재가-하단)/(상단-하단))"
                }
              />

              {insight.confidence != null && (
                <MetricBadge
                  label="평균 확신도"
                  value={`${insight.confidence.toFixed(1)}/10`}
                  title="13인 각자의 자기보고 확신도 평균입니다. 실제 정확도나 의견 일치도를 뜻하지 않습니다."
                />
              )}

              {insight.dispersionPct != null && (
                <MetricBadge
                  label="가격 분산"
                  value={`${insight.dispersionPct.toFixed(1)}%${
                    insight.priceEstimateCount != null
                      ? ` · ${insight.priceEstimateCount}/13`
                      : ""
                  }`}
                  title="13인의 개별 적정가 중앙 50%(Q1~Q3) 구간 폭 ÷ 중앙 적정가(IQR 분산율)입니다."
                />
              )}

              {insight.fairValueDeferred && (
                <span className="px-1.5 py-0.5 rounded border border-[#cbd5e1] bg-[#f8fafc] text-[#475569] font-mono text-[11px]">
                  적정가 산출 보류
                </span>
              )}

              {insight.voteAgreementPct != null && (
                <MetricBadge
                  label="표결 일치도"
                  value={`${insight.voteAgreementPct.toFixed(0)}%`}
                  title="가장 많이 나온 투자의견의 표 수 ÷ 유효 표결 수입니다. 확신도와는 다른 지표입니다."
                />
              )}

              {ratioText && (
                <MetricBadge
                  label="적정가/종가"
                  value={ratioText}
                  highlight
                />
              )}

              {safetyRatioText && (
                <MetricBadge label="안전마진/종가" value={safetyRatioText} />
              )}

              {insight.fairValue != null && (
                <span className="px-1.5 py-0.5 rounded border border-[#cbd5e1] bg-white text-[#0f172a] font-semibold font-mono text-[11px]">
                  적정가: {formatPriceByNation(insight.fairValue, undefined, ticker)}
                </span>
              )}

              <StabilityBadge stability={insight.intrinsicStability} />

              {extraMetrics}
            </div>

            {/* ── 하단 요약 텍스트 (리포트 전용) ── */}
            {summary && (
              <p className="text-xs text-[#64748b] line-clamp-1 leading-relaxed pt-0.5">
                {summary}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 pt-2 text-[#94a3b8] group-hover:text-[#0f172a]">
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </li>
  );
}
