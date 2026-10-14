"use client";

import React, { useState, useEffect } from "react";
import { GuruReportRow } from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { MarkdownViewer } from "@/components/ui/MarkdownViewer";
import { ReportSummariesView } from "@/components/tabs/ReportSummariesView";
import { ReportDatapackView } from "@/components/tabs/ReportDatapackView";
import { StockChartView } from "@/components/tabs/StockChartView";
import {
  extractValuationConsensus,
  getVoteAgreementPercent,
  formatPercentB,
  formatIntrinsicRatio,
  parseSafetyPrice,
  getIntrinsicStabilityMeta,
  IntrinsicStability,
} from "@/lib/insightUtils";
import { formatPriceByNation } from "@/lib/utils";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Users,
  PieChart,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { isReportRestricted } from "@/lib/subscription/subscriptionPolicy";

export type ResearchDocTab = "final" | "summaries" | "datapack" | "chart";

interface ResearchDocumentViewProps {
  report: GuruReportRow | null;
  onBack: () => void;
  availableDates?: string[];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  isLoadingDate?: boolean;
  percentB?: number | null;
  logoUrl?: string | null;
  intrinsicStability?: IntrinsicStability;
  activeTab?: ResearchDocTab;
  onTabChange?: (tab: ResearchDocTab) => void;
}

export function ResearchDocumentView({
  report,
  onBack,
  availableDates = [],
  selectedDate,
  onSelectDate,
  isLoadingDate = false,
  percentB,
  logoUrl,
  intrinsicStability,
  activeTab: activeTabProp,
  onTabChange,
}: ResearchDocumentViewProps) {
  const {
    tier,
    isTrialActive,
    trialRemainingHours,
    user,
    openUpgradeModal,
    openAuthModal,
  } = useSubscription();
  const isRestricted = report?.d
    ? isReportRestricted(report.d, tier, new Date(), undefined, isTrialActive)
    : false;

  // 사용자가 직접 선택한 탭 (현재 문서에 대한 것만 유효)
  const [tabOverride, setTabOverride] = useState<{ key: string; tab: ResearchDocTab } | null>(null);
  const docKey = report ? `${report.ticker}|${report.id}` : "none";
  // 리포트 변경 시 외부 prop이 없으면 final_report 여부에 따라 탭 자동 결정 (Effect 없이 파생)
  const defaultTab: ResearchDocTab = report?.final_report ? "final" : "chart";
  const activeTab =
    activeTabProp ?? (tabOverride && tabOverride.key === docKey ? tabOverride.tab : defaultTab);

  const handleTabClick = (tab: ResearchDocTab) => {
    setTabOverride({ key: docKey, tab });
    onTabChange?.(tab);
  };

  // ESC 키 누르면 목록으로 복귀
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  // 상단으로 스크롤
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [report?.ticker]);

  if (!report) return null;

  const valConsensus = extractValuationConsensus(report);
  const ticker = report.ticker;
  const companyName = report.company_name || ticker;
  const docId = `DOC-${report.d?.replace(/-/g, "") || "LIVE"}-${ticker}`;
  const verdict = report.verdict || "의견 조율 중";

  // 확신도 계산
  const confidenceSamples = (report.summaries || [])
    .filter((s) => s.parse_mode !== "fallback")
    .map((s) => s.confidence)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const confidence =
    confidenceSamples.length > 0
      ? confidenceSamples.reduce((sum, v) => sum + v, 0) / confidenceSamples.length
      : null;
  const voteAgreementPct = getVoteAgreementPercent(report);
  const dispersionPct = valConsensus?.dispersion_pct ?? null;

  // 내재가치 / 현재가 비율 계산
  const fairValue = valConsensus?.fair_value_price ?? null;
  const currentPrice = report.current_price ?? null;
  const intrinsicRatioPct =
    fairValue != null && currentPrice != null && currentPrice > 0
      ? (fairValue / currentPrice) * 100
      : null;
  const ratioText = formatIntrinsicRatio(intrinsicRatioPct);

  // 안전마진 / 현재가 비율 계산
  const safetyPriceValue =
    valConsensus?.safety_entry_value ??
    parseSafetyPrice(valConsensus?.safety_entry_price) ??
    parseSafetyPrice(report.safety_entry);
  const safetyRatioPct =
    safetyPriceValue != null && currentPrice != null && currentPrice > 0
      ? (safetyPriceValue / currentPrice) * 100
      : null;
  const safetyRatioText = formatIntrinsicRatio(safetyRatioPct);

  // 내재가치 안정성 메타
  const stabilityMeta = intrinsicStability ? getIntrinsicStabilityMeta(intrinsicStability) : null;

  // 흑백 투자의견 뱃지
  const renderMonochromeVerdict = (v: string) => {
    const lower = v.toLowerCase();
    if (lower.includes("매수") || lower.includes("buy")) {
      return (
        <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-[#0f172a] text-white border border-[#0f172a] font-semibold uppercase shrink-0">
          {v}
        </span>
      );
    }
    if (lower.includes("매도") || lower.includes("sell")) {
      return (
        <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-white text-[#0f172a] border border-[#64748b] font-medium uppercase shrink-0">
          {v}
        </span>
      );
    }
    return (
      <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] uppercase shrink-0">
        {v}
      </span>
    );
  };

  return (
    <article className="flex-1 min-w-0 flex flex-col bg-white font-sans divide-y divide-[#e2e8f0]">
      {/* ── 1. 브레드크럼 & 뒤로가기 바 ── */}
      <nav aria-label="문서 네비게이션" className="px-6 lg:px-12 py-3.5 bg-[#f8fafc] flex items-center justify-between text-xs font-mono">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[#0f172a] hover:text-black font-semibold cursor-pointer group transition-colors"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>카탈로그로 돌아가기</span>
        </button>

        <div className="flex items-center gap-2 text-[#64748b] hidden sm:flex">
          <span>SeedTick Research</span>
          <span>/</span>
          <span>Reports</span>
          <span>/</span>
          <span className="font-semibold text-[#0f172a]">${ticker}</span>
        </div>
      </nav>

      {/* ── 2. 에디토리얼 문서 헤더 ── */}
      <header className="px-6 lg:px-12 py-8 lg:py-10 bg-white space-y-6">
        {/* 상단 메타 ID 및 이력 셀렉터 */}
        <div className="flex items-center justify-between gap-3 flex-wrap font-mono text-xs text-[#64748b]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#0f172a] uppercase">{docId}</span>
            <span>·</span>
            <span>PUBLISHED: {report.d || "TODAY"}</span>
            <span>·</span>
            <span className="text-[#334155]">13 GURUS VALIDATED</span>
          </div>

          {availableDates.length > 1 && onSelectDate && (
            <div className="flex items-center gap-1.5 ml-auto bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1 rounded">
              <Calendar className="w-3.5 h-3.5 text-[#64748b]" />
              <span className="text-[#64748b]">분석 이력:</span>
              <select
                value={selectedDate || report.d}
                onChange={(e) => onSelectDate(e.target.value)}
                disabled={isLoadingDate}
                className="bg-transparent text-xs font-mono text-[#0f172a] font-semibold focus:outline-hidden cursor-pointer"
              >
                {availableDates.map((date) => {
                  const restricted = isReportRestricted(
                    date,
                    tier,
                    new Date(),
                    undefined,
                    isTrialActive
                  );
                  return (
                    <option key={date} value={date}>
                      {date} {date === report.d ? "(현재)" : ""}{" "}
                      {restricted ? "🔒 [Pro 전용]" : ""}
                    </option>
                  );
                })}
              </select>
              {isLoadingDate && (
                <span className="text-[#0f172a] animate-pulse text-[11px]">
                  로드 중...
                </span>
              )}
            </div>
          )}
        </div>

        {/* 타이틀 및 밸류에이션 요약 카드 */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={ticker}
                  className="w-10 h-10 rounded-md object-contain border border-[#e2e8f0] p-0.5 bg-white shrink-0 grayscale opacity-90 contrast-125"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-[#0f172a] text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
                  {ticker.slice(0, 3)}
                </div>
              )}

              <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
                {companyName}
              </h1>

              <span className="font-mono text-sm px-2 py-0.5 bg-[#f1f5f9] border border-[#e2e8f0] text-[#0f172a] font-semibold rounded">
                ${ticker}
              </span>

              {renderMonochromeVerdict(verdict)}
            </div>

            {/* 핵심 지표 인라인 뱃지 라인 (%B, 확신도, 내재가치/종가, 내재가치 안정성) */}
            <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
              {percentB !== undefined && (
                <span className="px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]">
                  %B: <strong className="text-[#0f172a]">{formatPercentB(percentB)}</strong>
                </span>
              )}

              {confidence != null && (
                <span className="px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]">
                  <span title="13인 각자의 자기보고 확신도 평균입니다. 실제 정확도나 의견 일치도를 뜻하지 않습니다.">평균 확신도:</span>{" "}
                  <strong className="text-[#0f172a]">{confidence.toFixed(1)}/10</strong>
                </span>
              )}

              {dispersionPct != null && (
                <span
                  title="13인의 개별 적정가 중점값 전체 범위 ÷ 중앙값입니다. 20%를 넘으면 단일 적정가를 보류합니다."
                  className="px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]"
                >
                  가격 분산: <strong className="text-[#0f172a]">
                    {dispersionPct.toFixed(1)}%
                    {valConsensus?.price_estimate_count != null
                      ? ` · ${valConsensus.price_estimate_count}/13`
                      : ""}
                  </strong>
                </span>
              )}

              {voteAgreementPct != null && (
                <span
                  title="가장 많이 나온 투자의견의 표 수 ÷ 유효 표결 수입니다. 확신도와는 다른 지표입니다."
                  className="px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]"
                >
                  표결 일치도: <strong className="text-[#0f172a]">{voteAgreementPct.toFixed(0)}%</strong>
                </span>
              )}

              {ratioText && (
                <span className="px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]">
                  적정가/종가:{" "}
                  <strong className="text-[#0f172a] font-bold">
                    {ratioText}
                  </strong>
                </span>
              )}

              {safetyRatioText && (
                <span className="px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#475569]">
                  안전마진/종가:{" "}
                  <strong className="text-[#0f172a] font-bold">
                    {safetyRatioText}
                  </strong>
                </span>
              )}

              {fairValue != null && (
                <span className="px-2 py-0.5 rounded border border-[#cbd5e1] bg-white text-[#0f172a] font-semibold">
                  적정가: {formatPriceByNation(fairValue, undefined, ticker)}
                </span>
              )}

              {stabilityMeta && (
                <Badge
                  variant={stabilityMeta.variant}
                  className="font-mono text-xs"
                  title="과거 보고서 가격의 분산입니다. 분석일별 입력 데이터의 차이는 분리하지 않습니다."
                >
                  과거 가격 안정성: {stabilityMeta.text}
                </Badge>
              )}
            </div>

            <p className="text-sm text-[#64748b] leading-relaxed">
              13인 모의 페르소나의 표결과 적정가 의견을 고정 규칙으로 집계한 보고서입니다.
              평균 확신도는 자기보고 값이며, 표결 일치도·가격 분산과 별도로 확인할 수 있습니다.
            </p>
          </div>

          {/* 현재가 / 내재가치 지표 박스 */}
          <div className="flex items-center gap-4 bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 rounded-md font-mono text-xs shrink-0 shadow-xs">
            <div>
              <span className="text-[#64748b] block text-[10px]">CURRENT PRICE</span>
              <span className="font-semibold text-base text-[#0f172a]">
                {report.current_price ? formatPriceByNation(report.current_price, undefined, ticker) : "-"}
              </span>
            </div>
            <div className="h-8 w-px bg-[#e2e8f0]" />
            <div>
              <span className="text-[#64748b] block text-[10px] font-semibold">CONSENSUS FAIR VALUE</span>
              <span className="font-bold text-base text-[#0f172a]">
                {valConsensus?.fair_value_price
                  ? formatPriceByNation(valConsensus.fair_value_price, undefined, ticker)
                  : "산출 보류"}
              </span>
            </div>
          </div>
        </div>

        {/* 표결 & 밴드 요약 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0]">
            <span className="text-[#64748b] text-[11px] block uppercase">
              13 Guru Round-Table Verdict
            </span>
            <span className="font-bold text-sm text-[#0f172a] mt-1 block">
              {report.vote_summary || "표결 정보 없음"}
            </span>
          </div>

          <div className="p-3.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0]">
            <span className="text-[#64748b] text-[11px] block uppercase">
              Central 50% Price Range & Safety Margin
            </span>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="font-bold text-sm text-[#0f172a]">
                {valConsensus?.target_price_band || "가격 구간 산출 보류"}
              </span>
              {valConsensus?.safety_entry_price && (
                <span className="text-[#0f172a] font-semibold text-xs bg-white border border-[#cbd5e1] px-2 py-0.5 rounded">
                  안전매수: {valConsensus.safety_entry_price}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── 3. 탭 네비게이션 (aihero.dev 스타일, 줄바꿈 방지) ── */}
      <div className="px-6 lg:px-12 bg-white sticky top-[56px] z-30 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-1 font-mono text-xs overflow-x-auto whitespace-nowrap scrollbar-none pb-px">
          {[
            { id: "final" as const, label: "01. 마스터 보고서", icon: FileText },
            { id: "summaries" as const, label: "02. 13인 개별 서머리", icon: Users },
            { id: "datapack" as const, label: "03. 심층 데이터팩", icon: PieChart },
            { id: "chart" as const, label: "04. 일봉 및 밴드", icon: TrendingUp },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-3 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-[#0f172a] text-[#0f172a] bg-slate-50/50"
                    : "border-transparent text-[#64748b] hover:text-[#0f172a] hover:border-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 4. 본문 리딩 영역 ── */}
      <section className="relative px-6 lg:px-12 py-8 bg-white min-h-[500px]">
        {/* 24시간 웰컴 무료 체험 중인 경우 상단 웰컴 배너 (모노톤) */}
        {isTrialActive && (
          <div className="mb-6 p-3 rounded-md bg-[#f8fafc] border border-[#cbd5e1] text-xs font-mono flex items-center justify-between gap-3 text-[#0f172a] shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-[#0f172a] text-white text-[10px] font-medium tracking-wider">
                TRIAL
              </span>
              <span className="font-semibold text-[#0f172a]">
                신규 회원 24시간 무료 체험 혜택 적용 중
              </span>
              <span className="hidden sm:inline text-[#64748b]">
                · 오늘 발행된 모든 최신 리포트를 제한 없이 열람하고 계세요.
              </span>
            </div>
            <span className="text-[11px] text-[#64748b] bg-white border border-[#e2e8f0] px-2 py-0.5 rounded shrink-0">
              {trialRemainingHours}시간 남음
            </span>
          </div>
        )}

        {/* Free 티어 사용자가 최근 1개월 보고서 열람 시 오버레이 */}
        {isRestricted && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-16 p-6 bg-white/80 backdrop-blur-md">
            <div className="max-w-md w-full bg-white rounded-md p-6 sm:p-8 border border-[#cbd5e1] shadow-xl text-center space-y-4 font-sans">
              <div className="w-10 h-10 rounded-md bg-[#0f172a] text-white flex items-center justify-center mx-auto shadow-2xs font-mono text-sm font-bold">
                {!user ? "PASS" : "PRO"}
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748b] block">
                  {!user ? "WELCOME 24H TRIAL PASS" : "MEMBERSHIP RESTRICTED DOCUMENT"}
                </span>
                <h3 className="text-lg font-bold text-[#0f172a] mt-1 tracking-tight">
                  {!user
                    ? "로그인하고 오늘 하루 무료로 열람하세요"
                    : "1일 무료 체험이 종료되었어요"}
                </h3>
              </div>
              <p className="text-[#64748b] text-xs leading-relaxed font-mono">
                {!user ? (
                  <>
                    회원가입 시 24시간 동안 모든 최신 13인 거장 AI 리서치 보고서와 SEC 데이터팩을 결제 없이 무료로 열람하실 수 있어요.
                  </>
                ) : (
                  <>
                    어제 둘러보신 13인 투자 거장 AI 합의 표결과 최신 정밀 리포트를 매일 실시간으로 계속 확인하시려면 Pro로 시작해보세요. (월 2,900원 · 하루 약 96원)
                  </>
                )}
              </p>
              <div className="space-y-2 pt-1 font-mono">
                {!user ? (
                  <button
                    type="button"
                    onClick={() => openAuthModal()}
                    className="w-full py-2.5 px-4 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white font-medium text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    1초 만에 로그인하고 무료로 보기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openUpgradeModal()}
                    className="w-full py-2.5 px-4 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white font-medium text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    Pro 멤버십 시작하기 (월 2,900원)
                  </button>
                )}
                <button
                  type="button"
                  onClick={onBack}
                  className="w-full py-2 px-4 rounded-md border border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] text-xs font-medium transition-colors cursor-pointer"
                >
                  과거 무료 보고서 보러가기
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`max-w-4xl ${isRestricted ? "filter blur-sm select-none pointer-events-none" : ""}`}>
          {activeTab === "final" && (
            report.final_report ? (
              <MarkdownViewer content={report.final_report} />
            ) : (
              <EmptyState
                icon="📄"
                title="최종 마스터 보고서가 생성 대기 중입니다"
                description="파이프라인이 완료되면 이곳에 전체 심층 분석 보고서가 문서화됩니다."
              />
            )
          )}

          {activeTab === "summaries" && (
            <ReportSummariesView summaries={report.summaries} />
          )}

          {activeTab === "datapack" && (
            <ReportDatapackView datapack={report.datapack} />
          )}

          {activeTab === "chart" && (
            <StockChartView
              ticker={report.ticker}
              companyName={report.company_name}
            />
          )}
        </div>
      </section>

      {/* ── 5. 하단 복귀 액션 바 ── */}
      <footer className="mt-auto px-6 lg:px-12 py-6 bg-[#fafafa] border-t border-[#e2e8f0] flex items-center justify-between font-mono text-xs text-[#64748b]">
        <span>SeedTick Research Archive · ${ticker}</span>
        <Button variant="secondary" size="sm" onClick={onBack} className="inline-flex items-center gap-1.5 cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>카탈로그로 돌아가기</span>
        </Button>
      </footer>
    </article>
  );
}
