"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Search,
  CheckCircle2,
  HelpCircle,
  Award,
  Users,
  Compass,
  ArrowRight,
  Target,
  Database,
  BarChart3,
  Zap,
  Activity,
  FileText,
  ChevronRight,
} from "lucide-react";
import {
  GURU_PERSONAS,
  getGuruPersonaBilingual,
  findGuruPersona,
} from "@/lib/guruPersonas";
import { GuruReportRow, StockCandidate, OutcomesOverview } from "@/types/api";
import { formatPriceByNation } from "@/lib/utils";
import { SidebarSectionId } from "@/components/sidebar/ResearchSidebar";
import { useLanguage } from "@/contexts/LanguageContext";

interface HomeServiceIntroProps {
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
  onSelectSection?: (sectionId: SidebarSectionId) => void;
  topDiscountReports?: Array<{
    report: GuruReportRow;
    ticker: string;
    companyName: string;
    fairValue: number | null;
    currentPrice: number | null;
    ratio: number;
  }>;
  topRomaCandidates?: StockCandidate[];
  topLiveCandidates?: StockCandidate[];
  topKrCandidates?: StockCandidate[];
  outcomesOverview?: OutcomesOverview | null;
  totalReportCount?: number;
  totalRomaCount?: number;
  totalCandidateCount?: number;
  onSelectReport?: (report: GuruReportRow) => void;
  onSelectCandidate?: (candidate: StockCandidate) => void;
  onRequestOnDemandAnalysis?: (ticker: string) => void;
}

export function HomeServiceIntro({
  onSearchChange,
  searchQuery = "",
  onSelectSection,
  topDiscountReports = [],
  topRomaCandidates = [],
  topLiveCandidates = [],
  topKrCandidates = [],
  outcomesOverview,
  totalReportCount = 0,
  totalRomaCount = 0,
  totalCandidateCount = 0,
  onSelectReport,
  onSelectCandidate,
  onRequestOnDemandAnalysis,
}: HomeServiceIntroProps) {
  const [activePreviewTab, setActivePreviewTab] = useState<
    "ranking" | "superinvestor" | "discovery" | "trackrecord"
  >("ranking");
  const [candidateMarket, setCandidateMarket] = useState<"us" | "kr">("us");

  const { isEn } = useLanguage();
  const guruList = Object.values(GURU_PERSONAS);

  return (
    <div className="space-y-16 py-6 font-sans">
      {/* ── 1. HERO SECTION: 서비스 본질 선언 ── */}
      <section
        id="hero-intro"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 via-[#0f172a] to-slate-900 text-white p-6 sm:p-10 lg:p-14 border border-slate-800 shadow-xl"
      >
        {/* 은은한 배경 그리드 효과 */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 font-mono text-xs text-blue-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>AI VALUE INVESTING RESEARCH PLATFORM</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
              {isEn ? (
                <>
                  Stop emotional investing.
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-teal-300">
                    Discover deterministic intrinsic values
                  </span>{" "}
                  from 13 investment legends
                </>
              ) : (
                <>
                  감정에 휘둘리는 투자를 멈추고,
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-teal-300">
                    13인 투자 거장의 냉철한 내재가치
                  </span>
                  를 확인하세요
                </>
              )}
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-3xl pt-1">
              {isEn ? (
                <>
                  Reportist is an independent stock research platform that revives the century-proven philosophies of{" "}
                  <strong>13 legendary investment gurus</strong>—including Warren Buffett, Benjamin Graham, and Peter Lynch—using quantitative algorithms and AI to analyze and publish intrinsic fair values and margin of safety daily for US & global equities.
                </>
              ) : (
                <>
                  리포티스트(Reportist)는 워런 버핏, 벤저민 그레이엄, 피터 린치 등 100년간 검증된
                  <strong> 13인 투자 거장의 원전 철학</strong>을 퀀트 알고리즘과 AI로 복원하여,
                  국내 및 미국 주식의 적정주가와 안전마진 밴드를 매일 분석·공시하는
                  독립 주식 리서치 시스템입니다.
                </>
              )}
            </p>
          </div>

          {/* 인라인 검색창 */}
          <div className="pt-2 max-w-2xl">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={
                  isEn
                    ? "Search any stock (e.g. AAPL, NVDA, TSLA, MSFT, 005930)..."
                    : "궁금한 종목을 검색해보세요 (예: AAPL, NVDA, 삼전, 현대차, 005930)"
                }
                className="w-full pl-11 pr-24 py-3 sm:py-3.5 text-xs sm:text-sm font-mono bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 rounded-xl border border-white/20 focus:border-blue-400 focus:outline-hidden transition-all shadow-inner"
              />
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => onRequestOnDemandAnalysis?.(searchQuery.trim())}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                >
                  {isEn ? "Request AI Report" : "AI 분석 요청"}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-mono flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                {isEn
                  ? "Continuously monitoring S&P500 DataRoma superinvestor & quality global equities"
                  : "S&P500 DataRoma 슈퍼인베스터, 한국 5단계 알짜 기업 상시 모니터링 중"}
              </span>
            </p>
          </div>

          {/* 핵심 지표 칩 */}
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs border-t border-slate-800">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-slate-400 text-[11px]">GURU MODELS</div>
              <div className="text-lg font-bold text-white mt-0.5">{isEn ? "13 Gurus" : "13인 거장"}</div>
              <div className="text-[10px] text-slate-400">{isEn ? "Cross-model audit" : "독립 모델 교차 검증"}</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-slate-400 text-[11px]">DAILY ARCHIVE</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {totalReportCount > 0 ? (isEn ? `${totalReportCount}+` : `${totalReportCount}건+`) : (isEn ? "Daily Updates" : "매일 갱신")}
              </div>
              <div className="text-[10px] text-slate-400">{isEn ? "Published after market close" : "한/미 장마감 후 자동발행"}</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-slate-400 text-[11px]">DISCOVERY POOL</div>
              <div className="text-lg font-bold text-white mt-0.5">
                {totalCandidateCount > 0
                  ? isEn
                    ? `${totalCandidateCount} Candidates`
                    : `${totalCandidateCount}후보`
                  : isEn
                  ? `${totalRomaCount} Equities`
                  : `${totalRomaCount}종목`}
              </div>
              <div className="text-[10px] text-slate-400">{isEn ? "Real-time candidate pool" : "한/미 실시간 발굴 후보군"}</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-slate-400 text-[11px]">TRANSPARENCY</div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">{isEn ? "100% Open" : "100% 공개"}</div>
              <div className="text-[10px] text-slate-400">{isEn ? "Formulas & track record" : "산출식 & 사후 성과 추적"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. [WHY & PROBLEM] 왜 리포티스트를 만들었나요? ── */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>01. Why Reportist · {isEn ? "Background" : "개발 배경"}</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f172a] tracking-tight">
            {isEn
              ? "“Should I buy this stock right now?” — When no one gives you an honest answer"
              : "“지금 이 주식 사도 될까?” — 그 누구도 정답을 알려주지 않기에"}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-3xl">
            {isEn
              ? "Reportist was founded to solve three chronic dilemmas individual investors face in the market."
              : "개인투자자가 주식 시장에서 마주하는 세 가지 고질적인 문제를 해결하기 위해 리포티스트를 시작했습니다."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 문제 1 */}
          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-2xs hover:shadow-sm transition-shadow">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
              01
            </div>
            <h3 className="text-base font-bold text-[#0f172a]">
              {isEn ? "Brokerage reports with over 90% 'Buy' ratings" : "90% 이상이 ‘매수’뿐인 증권사 리포트"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "Due to banking client relationships, sell-side reports rarely issue sell ratings even at bubble peaks. Investors repeatedly get trapped by opaque target prices."
                : "증권사 보고서는 기업 고객과의 이해관계 때문에 주가가 고점이어도 매도 의견을 거의 내지 못합니다. 근거가 불투명한 목표주가에 속아 고점에 물리는 일이 반복됩니다."}
            </p>
          </div>

          {/* 문제 2 */}
          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-2xs hover:shadow-sm transition-shadow">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              02
            </div>
            <h3 className="text-base font-bold text-[#0f172a]">
              {isEn ? "Emotional FOMO trading and rumor-driven investing" : "감정에 휘둘리는 뇌동매매와 소문 투자"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "Buying from greed and selling from panic based on YouTube tips or chatrooms always leads to portfolio losses. Without disciplined rules, you cannot survive a crash."
                : "유튜브 추천, 리딩방 찌라시, 급등주 테마에 올라타 탐욕으로 사고 공포로 파는 감정적 투자는 결국 계좌 손실로 이어집니다. 기준이 없으면 폭락장에서 버틸 수 없습니다."}
            </p>
          </div>

          {/* 문제 3 */}
          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-2xs hover:shadow-sm transition-shadow">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
              03
            </div>
            <h3 className="text-base font-bold text-[#0f172a]">
              {isEn ? "Intrinsic valuation is too overwhelming for individuals" : "개인이 직접 하기엔 너무 벅찬 기업 가치평가"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "DCF modeling, Net Current Asset Value (NCAV), economic moats, capital allocation efficiency... Retail investors lack the time to dissect 10 years of filings every day."
                : "현금흐름 할인(DCF), 순유동자산(NCAV), 경제적 해자 검증, 자본배치 효율성... 복잡한 재무제표와 분기 공시를 직장인이 매일 뜯어보기에는 시간과 지식이 부족합니다."}
            </p>
          </div>
        </div>

        {/* 해결책 박스 */}
        <div className="p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200 text-[#0f172a] space-y-2">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold text-blue-700 uppercase">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>{isEn ? "The Reportist Solution" : "리포티스트가 내놓은 해답"}</span>
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-[#334155]">
            {isEn ? (
              <>
                <strong>
                  &ldquo;What if 13 legendary gurus gathered as an objective third party to dissect financial statements and evaluate fair values?&rdquo;
                </strong>
                <br className="hidden sm:inline" />
                {" "}Reportist eliminates human greed and fear, combining mathematical quant formulas with original philosophies to derive objective intrinsic values.
              </>
            ) : (
              <>
                <strong>
                  &ldquo;이해관계 없는 제3자로서, 100년간 검증된 전설의 투자 거장 13인이 한자리에 모여 기업의 재무제표를 냉철하게 뜯어보고 적정 주가를 매겨준다면 어떨까?&rdquo;
                </strong>
                <br className="hidden sm:inline" />
                리포티스트는 인간의 탐욕과 공포를 배제하고, 수학적 퀀트 모델과 원전 철학을 결합해 객관적인 내재가치를 도출합니다.
              </>
            )}
          </p>
        </div>
      </section>

      {/* ── 3. [BENEFIT] 투자자에게 어떤 유익한 점이 있나요? ── */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>02. Key Benefits · {isEn ? "Core Values & Benefits" : "핵심 가치와 혜택"}</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f172a] tracking-tight">
            {isEn ? "4 Clear Advantages You Gain from Reportist" : "리포티스트를 통해 얻을 수 있는 4가지 명확한 이점"}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-3xl">
            {isEn
              ? "More than a stock quote board, Reportist serves as a true compass for investment decisions."
              : "단순한 주가 시세판이 아닌, 투자 판단의 명확한 나침반이 되어 드립니다."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              {isEn ? "Deterministic Fair Value & Upside" : "적정 내재가치 & 괴리율 제시"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "Instantly see whether current stock price is undervalued or overvalued. We calculate upside against guru consensus fair value in real time."
                : "“지금 주가가 싼가 비싼가?”를 한눈에 확인하세요. 거장들이 합의한 내재가치 대비 상승여력(괴리율)을 실시간으로 계산해 순위를 매깁니다."}
            </p>
          </div>

          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              {isEn ? "Margin of Safety Entry Price" : "안전마진(Margin of Safety) 가격"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "“At what price can I sleep soundly?” We present conservative margin-of-safety buy prices that protect your capital against downside risk."
                : "“얼마에 사야 마음 편히 잘 수 있는가?” 하방 위험을 든든하게 막아주는 보수적 안전마진 매수가를 제시해 원금 보존 확률을 극대화합니다."}
            </p>
          </div>

          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              {isEn ? "13-Guru Cross Validation" : "13인의 입체적 교차 검증"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "Buffett (Moat & ROE), Graham (Liquidation NCAV), Lynch (PEG), Damodaran (DCF)—13 independent lenses eliminate the blind spots of single-metric investing."
                : "버핏(해자·ROE), 그레이엄(청산가치), 린치(성장률 PEG), 다모다란(DCF) 등 서로 다른 13인의 독립 시선으로 단일 지표의 맹점을 사전에 차단합니다."}
            </p>
          </div>

          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#0f172a]">
              {isEn ? "Automated Post-Close Daily Reports" : "매일 장마감 후 자동 리포트"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "Every day after US & Korean market close, automated pipelines fetch fresh financials and market quotes to issue comprehensive deep-dive reports."
                : "미국장 오전 09시, 한국장 오후 16시마다 배치 파이프라인이 최신 주가와 재무 데이터를 수집해 자동으로 심층 보고서를 생성합니다."}
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. [SCREENING] 종목 선정은 어떻게 하고 있나요? ── */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            <span>03. Universe & Screening · {isEn ? "Selection Criteria" : "종목 선정 기준"}</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f172a] tracking-tight">
            {isEn
              ? "100% Exclude Penny Stocks: Only Proven Quality Equities"
              : "테마주·잡주는 100% 배제하고, 검증된 우량주만 심사합니다"}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-3xl">
            {isEn
              ? "Garbage in, garbage out. Reportist only feeds companies that pass rigorous quantitative criteria into our valuation engine."
              : "쓰레기 데이터가 들어가면 쓰레기 결과가 나옵니다. 리포티스트는 엄격한 정량 기준을 통과한 핵심 유니버스만 밸류에이션 파이프라인으로 투입합니다."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 미국 주식 스크리닝 원칙 */}
          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-base text-[#0f172a] flex items-center gap-2">
                <span>🇺🇸</span>
                <span>{isEn ? "US Stock Universe Screening" : "미국 주식 유니버스 스크리닝"}</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                S&P500 + DataRoma
              </span>
            </div>
            <ul className="space-y-2.5 text-xs text-[#475569]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {isEn ? (
                    <>
                      <strong>S&P 500 Blue Chips</strong>: Core companies possessing sustainable global competitive moats
                    </>
                  ) : (
                    <>
                      <strong>S&P500 대형 우량주</strong>: 글로벌 시장에서 지속 가능한 경쟁우위(Moat)를 보유한 핵심 기업군 선별
                    </>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {isEn ? (
                    <>
                      <strong>DataRoma Superinvestor Portfolios</strong>: Cross-auditing stocks co-held by 10+ top Wall Street giants including Warren Buffett, Seth Klarman, and Howard Marks
                    </>
                  ) : (
                    <>
                      <strong>DataRoma 그랜드 포트폴리오 연동</strong>: 워런 버핏, 세스 클라만, 하워드 막스 등 월가 최고 거물 10인 이상이 동시 보유한 종목 교차 검증
                    </>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {isEn ? (
                    <>
                      <strong>Guru Financial Hurdles</strong>: Only companies meeting debt coverage, sustained profitability, and capital efficiency enter the final analysis
                    </>
                  ) : (
                    <>
                      <strong>13인 거장 공통 재무 허들 통과</strong>: 부채 상환 능력, 최근 연속 흑자, 자본 효율성을 충족한 종목만 최종 분석
                    </>
                  )}
                </span>
              </li>
            </ul>
          </div>

          {/* 한국 주식 스크리닝 원칙 */}
          <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-base text-[#0f172a] flex items-center gap-2">
                <span>🇰🇷</span>
                <span>{isEn ? "Korean Stock 5-Step Quality Filter" : "한국 주식 5단계 알짜 기업 필터"}</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isEn ? "5-Step Filter (Quality Stocks)" : "5단계 고정 (알짜 우량주)"}
              </span>
            </div>
            <p className="text-xs text-[#64748b]">
              {isEn
                ? "Out of 2,500+ KOSPI & KOSDAQ companies, only businesses that pass all 5 quantitative filters are selected:"
                : "코스피·코스닥 2,500여 개 전 종목 중 타협 없는 5대 정량 기준을 100% 통과한 알짜배기 기업만 발굴합니다:"}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[10px]">{isEn ? "Step 1 · Market Size" : "1단계 · 시장 검증"}</span>
                <div className="font-bold text-slate-800">{isEn ? "Market Cap ₩500B+" : "시가총액 5,000억↑"}</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[10px]">{isEn ? "Step 2 · Financial Safety" : "2단계 · 재무 안전성"}</span>
                <div className="font-bold text-slate-800">{isEn ? "Debt Ratio < 80%" : "부채비율 80%↓"}</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[10px]">{isEn ? "Step 3 · Debt Coverage" : "3단계 · 채무 감당력"}</span>
                <div className="font-bold text-slate-800">{isEn ? "Coverage > 5.0x" : "이자보상 5.0배↑"}</div>
              </div>
              <div className="space-y-0.5">
                <span className="text-slate-500 text-[10px]">{isEn ? "Step 4 · Operating Margin" : "4단계 · 영업 마진율"}</span>
                <div className="font-bold text-slate-800">{isEn ? "OP Margin > 15%" : "영업이익률 15%↑"}</div>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 text-[10px]">{isEn ? "Step 5 · Capital Efficiency" : "5단계 · 자본배치 효율성"}</span>
                <span className="font-bold text-blue-700">{isEn ? "ROE > 15%" : "ROE(자기자본이익률) 15%↑"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. [TRUST & ACCURACY] 신뢰할 만한가요? ── */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>04. Transparency & Trust · {isEn ? "Reliability & Objectivity" : "신뢰성과 객관성"}</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f172a] tracking-tight">
            {isEn
              ? "No Black-Box AI: 100% Open Formulas & Historical Track Record"
              : "블랙박스 AI가 아닙니다. 모든 산출식과 사후 성과를 100% 공개합니다"}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-3xl">
            {isEn
              ? "We reject irresponsible predictions with hidden mechanics. Reportist reveals the entire valuation process so investors can inspect and verify."
              : "결과만 툭 던져주는 무책임한 예측을 거부합니다. 리포티스트는 투자자가 직접 검증할 수 있도록 모든 과정을 투명하게 공개합니다."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-2xs">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0f172a]">
              {isEn ? "100% Open Formulas & Checklists" : "100% 공개된 산출식과 체크리스트"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "Warren Buffett's 10-year ROE, Graham's NCAV liquidation value, Lynch's PEG, and Damodaran's DCF formulas and rationales are displayed in full transparency."
                : "워런 버핏의 10년 ROE 산출, 그레이엄의 순유동자산(NCAV) 청산가치, 린치의 성장률 대비 PEG, 다모다란의 현금흐름 할인(DCF) 등 각 거장의 평가 수식과 판단 근거 문장을 리포트에 여과 없이 표시합니다."}
            </p>
          </div>

          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-2xs">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0f172a]">
              {isEn ? "Consensus Rates & Opinion Dispersion" : "합의율(Consensus)과 의견 분산도"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "How many of the 13 gurus voted Buy, and how tightly their valuations align. High agreement with low dispersion signals high conviction."
                : "13인 중 몇 명이 찬성했는지, 거장 간 의견이 얼마나 일치하는지(분산도)를 통계로 제공합니다. 의견 일치율이 높고 분산도가 낮을수록 신뢰도가 높은 확신 종목입니다."}
            </p>
          </div>

          <div className="p-5 rounded-xl border border-[#e2e8f0] bg-white space-y-3 shadow-2xs">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0f172a]">
              {isEn ? "Public Historical Track Record" : "사후 성과 및 적중률(Track Record) 공시"}
            </h3>
            <p className="text-xs text-[#64748b] leading-relaxed">
              {isEn
                ? "We track past reports against actual market price movements. Showing both winners and misses proves system integrity."
                : "과거에 발행된 보고서의 매수/보유 판정이 실제 주가 흐름과 어떻게 일치했는지 사후 추적합니다. 맞춘 종목뿐 아니라 틀린 종목까지 투명하게 공개하여 시스템의 건전성을 스스로 입증합니다."}
            </p>
            <button
              onClick={() => onSelectSection?.("sec-outcomes")}
              className="text-xs font-mono font-semibold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer pt-1"
            >
              <span>{isEn ? "Inspect Track Record Dashboard" : "성과 추적 트랙레코드 확인하기"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 6. [HOW IT WORKS & TECH] 어떠한 기술이 들어갔으며 어떻게 동작하나요? ── */}
      <section className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5" />
            <span>05. Architecture & Pipeline · {isEn ? "How It Works & Tech Stack" : "동작 방식과 기술 스택"}</span>
          </div>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f172a] tracking-tight">
            {isEn
              ? "4-Step Intelligent Valuation Pipeline Running Daily"
              : "매일 자동으로 돌아가는 4단계 지능형 밸류에이션 파이프라인"}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-3xl">
            {isEn
              ? "From raw facts collection to quant formulas, multi-LLM guru audits, and consensus valuation—100% automated."
              : "원천 팩트 수집부터 퀀트 연산, AI 거장 다면 평가, 최종 컨센서스 도출까지 한 치의 오차 없이 자동화되어 있습니다."}
          </p>
        </div>

        {/* 4단계 파이프라인 플로우 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-2 relative">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-bold text-blue-600">STEP 01</span>
              <span>12:00 KST</span>
            </div>
            <h4 className="font-bold text-sm text-[#0f172a] font-sans">
              {isEn ? "Quality Universe Screening" : "우량 유니버스 스크리닝"}
            </h4>
            <p className="text-[11px] text-[#64748b] font-sans leading-relaxed">
              {isEn
                ? "Validates market holidays and gathers stocks meeting S&P500, DataRoma, and quality criteria."
                : "휴장일 여부를 검사하고 S&P500·DataRoma·한국 알짜 기업 재무 조건을 통과한 타깃 종목을 자동 수집합니다."}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-2 relative">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-bold text-blue-600">STEP 02</span>
              <span>FACT FIRST</span>
            </div>
            <h4 className="font-bold text-sm text-[#0f172a] font-sans">
              {isEn ? "Fact DataPack Construction" : "팩트 데이터팩(DataPack) 구축"}
            </h4>
            <p className="text-[11px] text-[#64748b] font-sans leading-relaxed">
              {isEn
                ? "Assembles 10-year financial statements and live quotes from Yahoo Finance, SEC 10-K/10-Q, and DART filings."
                : "Yahoo Finance, SEC 10-K/10-Q 공시, DART 전자공시에서 10년 재무제표와 실시간 시세를 수집해 팩트 데이터를 구축합니다."}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-2 relative">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-bold text-blue-600">STEP 03</span>
              <span>QUANT + LLM</span>
            </div>
            <h4 className="font-bold text-sm text-[#0f172a] font-sans">
              {isEn ? "13-Guru Parallel Evaluation" : "13인 거장 모델 병렬 심사"}
            </h4>
            <p className="text-[11px] text-[#64748b] font-sans leading-relaxed">
              {isEn
                ? "Python quant algorithms and multi-LLM gateways score stocks against each guru's core checklist independently."
                : "Python 퀀트 엔진의 가치평가 수식과 AI 게이트웨이의 멀티 LLM이 13인 거장의 체크리스트를 기반으로 독립 평가를 내립니다."}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#e2e8f0] bg-white space-y-2 relative">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-bold text-blue-600">STEP 04</span>
              <span>CONSENSUS</span>
            </div>
            <h4 className="font-bold text-sm text-[#0f172a] font-sans">
              {isEn ? "Consensus & Report Publishing" : "적정주가 컨센서스 & 리포트 발행"}
            </h4>
            <p className="text-[11px] text-[#64748b] font-sans leading-relaxed">
              {isEn
                ? "Aggregates guru votes, computes consensus fair value & margin of safety, publishing directly to DB & web."
                : "13인의 표결(매수/보유/매도)을 집계하고 종합 적정주가와 안전마진 가격을 산출하여 Supabase DB 및 웹으로 즉시 발행합니다."}
            </p>
          </div>
        </div>

        {/* 기술 스택 스펙 바 */}
        <div className="p-5 rounded-xl bg-slate-900 text-white font-mono text-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 text-slate-300">
            <span className="font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span>Reportist Core Tech Stack & Architecture</span>
            </span>
            <span className="text-[11px] text-slate-400">High Reliability & Pure Value</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-[11px]">
            <div className="space-y-1">
              <div className="text-blue-400 font-semibold">1. Python Quant Engine (Analyzer)</div>
              <p className="text-slate-400 leading-relaxed font-sans">
                {isEn
                  ? "FastAPI, Pandas, automated SEC/DART crawlers, 13-guru quantitative mathematical modeling, Bollinger %B time-series engine"
                  : "FastAPI, Pandas, SEC/DART 자동 크롤러, 13인 금융 밸류에이션 수학 모델링, Bollinger %B 시계열 연산"}
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-teal-400 font-semibold">2. Multi-Model AI Gateway</div>
              <p className="text-slate-400 leading-relaxed font-sans">
                {isEn
                  ? "Vercel Edge Proxy, multi-LLM key rotation, automatic failover on 429/500 errors, deterministic structured JSON outputs"
                  : "Vercel Edge Proxy, 멀티 LLM 키 로테이션, 429/500 장애 시 자동 페일오버, 일관성 있는 구조화 JSON 출력"}
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-sky-400 font-semibold">3. High Performance Web & DB</div>
              <p className="text-slate-400 leading-relaxed font-sans">
                {isEn
                  ? "Next.js 15 App Router, React 19, Supabase PostgreSQL, 5-minute ISR caching, full SEO Schema.org compatibility"
                  : "Next.js 15 App Router, React 19, Supabase PostgreSQL, ISR 5분 캐싱, SEO Schema.org 완벽 대응"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. [GURUS SHOWCASE] 13인 투자 거장 철학 쇼케이스 ── */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>06. The 13 Gurus · {isEn ? "Lineup of Legendary Investors" : "13인 투자 거장 라인업"}</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f172a] tracking-tight">
              {isEn
                ? "13 Legendary Philosophies Dominating 100 Years of Finance"
                : "100년 금융사를 지배한 13인의 전설적인 철학"}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-2xl">
              {isEn
                ? "Click on each guru to explore their unique investment philosophy and checklist criteria."
                : "각 거장의 고유한 심사 철학과 체크리스트 기준을 클릭하여 자세히 살펴보세요."}
            </p>
          </div>
          <button
            onClick={() => onSelectSection?.("sec-gurus")}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer shrink-0"
          >
            <span>{isEn ? "Explore all 13 Guru Guides" : "13인 전체 철학 가이드 상세 보기"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 font-sans">
          {guruList.slice(0, 6).map((rawGuru) => {
            const guru = getGuruPersonaBilingual(rawGuru, isEn) || rawGuru;
            return (
              <Link
                key={guru.slug}
                href={(isEn ? "/en/gurus/" : "/gurus/") + encodeURIComponent(guru.slug) + "?from=all"}
                className="p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0f172a] hover:shadow-xs transition-all flex flex-col justify-between group space-y-2.5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#0f172a] group-hover:text-blue-600 transition-colors">
                      {isEn ? guru.englishName : guru.name}
                    </span>
                    <span className="text-[10px] font-mono text-[#94a3b8] uppercase">
                      {isEn ? guru.slug : guru.englishName}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-blue-700 font-medium mt-0.5">
                    {guru.style}
                  </div>
                  <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed line-clamp-2">
                    &ldquo;{guru.oneLiner}&rdquo;
                  </p>
                </div>

                <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                  <span className="truncate max-w-[180px]">📖 {guru.bookTitle}</span>
                  <span className="text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    {isEn ? "Checklist →" : "심사기준 →"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {guruList.length > 6 && (
          <div className="text-center pt-1">
            <button
              onClick={() => onSelectSection?.("sec-gurus")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#cbd5e1] hover:border-[#0f172a] bg-white text-xs font-mono font-semibold text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer"
            >
              <span>{isEn ? "View all 13 Gurus (Fisher, Marks, Klarman, Greenblatt, etc.)" : "13인 거장 전체(피셔, 막스, 클라만, 그린블라트 등) 살펴보기"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* ── 8. [RESEARCH HUB PREVIEW] 실시간 리서치 데이터 미리보기 ── */}
      <section className="space-y-6 pt-4 border-t border-[#e2e8f0]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-blue-600 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" />
              <span>Live Research Sections · {isEn ? "Live Research Preview" : "실시간 리서치 미리보기"}</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0f172a] tracking-tight">
              {isEn
                ? "Explore the Latest Research on Reportist Right Now"
                : "지금 바로 리포티스트의 최신 리서치를 둘러보세요"}
            </h2>
            <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed max-w-2xl">
              {isEn
                ? "Select a tab to view highlighted equities, or jump straight to full section data."
                : "원하는 섹션 탭을 선택하여 주요 종목을 확인하거나, 각 섹션의 전체 데이터로 이동할 수 있습니다."}
            </p>
          </div>

          {/* 탭 네비게이션 */}
          <div className="inline-flex p-1 bg-[#f1f5f9] rounded-xl font-mono text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setActivePreviewTab("ranking")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${activePreviewTab === "ranking"
                ? "bg-white text-[#0f172a] font-bold shadow-2xs"
                : "text-[#64748b] hover:text-[#0f172a]"
                }`}
            >
              🎯 {isEn ? "Guru Fair Value Rankings" : "거장 가치평가 랭킹"}
            </button>
            <button
              onClick={() => setActivePreviewTab("superinvestor")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${activePreviewTab === "superinvestor"
                ? "bg-white text-[#0f172a] font-bold shadow-2xs"
                : "text-[#64748b] hover:text-[#0f172a]"
                }`}
            >
              🏛️ {isEn ? "Superinvestor Portfolio" : "슈퍼인베스터 포트폴리오"}
            </button>
            <button
              onClick={() => setActivePreviewTab("discovery")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${activePreviewTab === "discovery"
                ? "bg-white text-[#0f172a] font-bold shadow-2xs"
                : "text-[#64748b] hover:text-[#0f172a]"
                }`}
            >
              🧭 {isEn ? "Real-time Discovery Candidates" : "실시간 발굴 후보군"}
            </button>
            <button
              onClick={() => setActivePreviewTab("trackrecord")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${activePreviewTab === "trackrecord"
                ? "bg-white text-[#0f172a] font-bold shadow-2xs"
                : "text-[#64748b] hover:text-[#0f172a]"
                }`}
            >
              🏆 {isEn ? "Track Record & Accuracy" : "성과 및 거장 적중률"}
            </button>
          </div>
        </div>

        {/* 탭 1: 거장 가치평가 랭킹 TOP 5 */}
        {activePreviewTab === "ranking" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-xs text-[#64748b]">
              <span>{isEn ? "Top Upside Opportunities vs. Intrinsic Fair Value" : "내재가치 대비 상승여력(저평가율) 상위 하이라이트"}</span>
              <button
                onClick={() => onSelectSection?.("sec-reports")}
                className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{isEn ? `View Full Valuation Rankings (${totalReportCount})` : `전체 가치평가 랭킹 보기 (${totalReportCount}건)`}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {topDiscountReports.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-mono">
                {isEn ? "Valuation rankings data is currently being indexed." : "현재 가치평가 랭킹 데이터를 집계하고 있습니다."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {topDiscountReports.slice(0, 6).map((item, idx) => (
                  <Link
                    key={item.ticker}
                    href={(isEn ? "/en/stocks/" : "/stocks/") + encodeURIComponent(item.ticker) + "?from=all"}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                      e.preventDefault();
                      onSelectReport?.(item.report);
                    }}
                    className="p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0f172a] hover:shadow-xs transition-all flex flex-col justify-between group space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-[10px] text-slate-400 font-bold">
                          #{idx + 1}
                        </span>
                        <div className="font-bold text-base text-[#0f172a] group-hover:text-blue-600 transition-colors">
                          {item.ticker}
                        </div>
                        <div className="text-xs text-[#64748b] truncate max-w-[160px]">
                          {isEn ? (item.report.company_name_en || item.companyName) : item.companyName}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono font-bold text-xs">
                        +{Math.round(item.ratio - 100)}% {isEn ? "Upside" : "괴리"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between font-mono text-xs text-[#64748b]">
                      <div>
                        <span>{isEn ? "Current: " : "현재가: "}</span>
                        <span className="font-semibold text-slate-800">
                          {formatPriceByNation(item.currentPrice, undefined, item.ticker)}
                        </span>
                      </div>
                      <div>
                        <span>{isEn ? "Fair Value: " : "적정가: "}</span>
                        <span className="font-bold text-blue-700">
                          {formatPriceByNation(item.fairValue, undefined, item.ticker)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 탭 2: 슈퍼인베스터 포트폴리오 TOP 5 */}
        {activePreviewTab === "superinvestor" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-xs text-[#64748b]">
              <span>{isEn ? "Equities Co-held by 10+ Wall Street Superinvestors" : "월가 슈퍼인베스터 10인 이상이 동시 보유한 핵심 종목"}</span>
              <button
                onClick={() => onSelectSection?.("sec-roma")}
                className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{isEn ? `View Full Superinvestor Portfolio (${totalRomaCount})` : `슈퍼인베스터 포트폴리오 전체 보기 (${totalRomaCount}개)`}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {topRomaCandidates.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-mono">
                {isEn ? "Loading DataRoma superinvestor portfolio..." : "DataRoma 슈퍼인베스터 포트폴리오를 불러오는 중입니다."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {topRomaCandidates.slice(0, 6).map((c) => (
                  <Link
                    key={`roma-${c.ticker}`}
                    href={(isEn ? "/en/stocks/" : "/stocks/") + encodeURIComponent(c.ticker) + "?from=all"}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                      e.preventDefault();
                      onSelectCandidate?.(c);
                    }}
                    className="p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0f172a] hover:shadow-xs transition-all flex flex-col justify-between group space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-base text-[#0f172a] group-hover:text-blue-600 transition-colors">
                          {c.ticker}
                        </div>
                        <div className="text-xs text-[#64748b] truncate max-w-[160px]">
                          {c.name || c.ticker}
                        </div>
                      </div>
                      {c.holders != null && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-bold">
                          {c.holders} {isEn ? "Gurus" : "인 보유"}
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between font-mono text-xs text-[#64748b]">
                      <span>{formatPriceByNation(c.price, undefined, c.ticker)}</span>
                      {c.roe != null && <span>ROE: {(c.roe * 100).toFixed(1)}%</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 탭 3: 실시간 발굴 후보군 TOP 5 */}
        {activePreviewTab === "discovery" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-xs text-[#64748b]">
              <div className="flex items-center gap-2">
                <span>{isEn ? "Candidates Passing Real-Time Screening" : "실시간 스크리닝 통과 후보군"}</span>
                <span className="text-slate-300">|</span>
                <div className="inline-flex gap-1 text-[11px]">
                  <button
                    onClick={() => setCandidateMarket("us")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${candidateMarket === "us" ? "bg-slate-900 text-white font-bold" : "text-slate-500"
                      }`}
                  >
                    🇺🇸 {isEn ? "US Market" : "미국장"} ({topLiveCandidates.length})
                  </button>
                  <button
                    onClick={() => setCandidateMarket("kr")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${candidateMarket === "kr" ? "bg-slate-900 text-white font-bold" : "text-slate-500"
                      }`}
                  >
                    🇰🇷 {isEn ? "KR Market" : "한국장"} ({topKrCandidates.length})
                  </button>
                </div>
              </div>

              <button
                onClick={() => onSelectSection?.("sec-screener")}
                className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{isEn ? "Open Live Screener" : "실시간 스크리너 전체 보기"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {(() => {
              const list = candidateMarket === "us" ? topLiveCandidates : topKrCandidates;
              if (list.length === 0) {
                return (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-mono">
                    {isEn ? "Loading candidates data..." : "후보군 데이터를 불러오는 중입니다."}
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {list.slice(0, 6).map((c) => (
                    <Link
                      key={`candidate-${c.ticker}`}
                      href={(isEn ? "/en/stocks/" : "/stocks/") + encodeURIComponent(c.ticker) + "?from=all"}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                        e.preventDefault();
                        onSelectCandidate?.(c);
                      }}
                      className="p-4 rounded-xl border border-[#e2e8f0] bg-white hover:border-[#0f172a] hover:shadow-xs transition-all flex flex-col justify-between group space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-base text-[#0f172a] group-hover:text-blue-600 transition-colors">
                            {c.ticker}
                          </div>
                          <div className="text-xs text-[#64748b] truncate max-w-[160px]">
                            {c.name || c.ticker}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          {candidateMarket === "kr" ? (isEn ? "5-Step Quality" : "알짜 5단계") : `SCORE ${c.guru_score || 0}`}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between font-mono text-xs text-[#64748b]">
                        <span>{formatPriceByNation(c.price, undefined, c.ticker)}</span>
                        {c.roe != null && <span>ROE: {(c.roe * 100).toFixed(1)}%</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* 탭 4: 성과 및 거장 적중률 (Track Record) */}
        {activePreviewTab === "trackrecord" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between font-mono text-xs text-[#64748b]">
              <span>{isEn ? "Historical Price Performance & Guru Prediction Accuracy" : "과거 발행 리포트의 실제 주가 성과와 거장 예측 적중률"}</span>
              <button
                onClick={() => onSelectSection?.("sec-outcomes")}
                className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{isEn ? "View Complete Accuracy Analysis" : "성과 및 적중률 전체 분석 보기"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-6 rounded-xl border border-[#e2e8f0] bg-white space-y-4 shadow-2xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-slate-500 text-[11px]">HISTORICAL TRACK RECORD</div>
                  <div className="text-xl font-bold text-[#0f172a] font-sans">
                    {outcomesOverview?.total_reports_tracked != null
                      ? isEn
                        ? `${outcomesOverview.total_reports_tracked} Tracked Reports`
                        : `${outcomesOverview.total_reports_tracked}건 전수 추적`
                      : isEn
                      ? "Transparent Verification"
                      : "투명한 사후 검증"}
                  </div>
                  <p className="text-xs text-[#64748b] font-sans leading-relaxed pt-1">
                    {outcomesOverview?.fair_value_hit_rate_pct != null
                      ? isEn
                        ? `${(outcomesOverview.fair_value_hit_rate_pct * 100).toFixed(0)}% Fair value target hit rate (Live post-audit)`
                        : `적정가 도달률 ${(outcomesOverview.fair_value_hit_rate_pct * 100).toFixed(0)}% 달성 (실시간 사후 검증)`
                      : isEn
                      ? "Auditing post-verdict price movements against real market data."
                      : "매수/보유/매도 판정 후 실제 시장 주가와의 일치도를 전수 추적합니다."}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-blue-50/60 border border-blue-200 space-y-1">
                  <div className="text-blue-700 text-[11px] font-semibold">TOP ACCURATE GURU</div>
                  <div className="text-xl font-bold text-blue-900 font-sans">
                    {outcomesOverview?.top_guru?.name
                      ? `${isEn ? (findGuruPersona(outcomesOverview.top_guru.name)?.englishName || outcomesOverview.top_guru.name) : outcomesOverview.top_guru.name} ${(outcomesOverview.top_guru.accuracy_pct * 100).toFixed(0)}%`
                      : isEn
                      ? "Disclosed Accuracy"
                      : "숨김없는 적중률 공시"}
                  </div>
                  <p className="text-xs text-blue-800/80 font-sans leading-relaxed pt-1">
                    {isEn
                      ? "Transparent accuracy disclosure with nothing concealed, even missed targets."
                      : "빗나간 분석까지 감추지 않고 투명하게 공개하여 시스템의 신뢰도를 스스로 검증합니다."}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-1">
                  <div className="text-emerald-700 text-[11px] font-semibold">SAFETY MARGIN EFFECT</div>
                  <div className="text-xl font-bold text-emerald-900 font-sans">
                    {isEn ? "Downside Protection" : "하방 리스크 방어"}
                  </div>
                  <p className="text-xs text-emerald-800/80 font-sans leading-relaxed pt-1">
                    {isEn
                      ? "Buying below margin of safety significantly preserved capital during sharp market pullbacks."
                      : "안전마진 가격 이하 매수 시 시장 급락기에도 원금 보존 확률이 크게 향상되었습니다."}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onSelectSection?.("sec-outcomes")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>{isEn ? "Go to Track Record Dashboard" : "상세 성과 및 거장 적중률 대시보드 바로가기"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 9. 하단 CTA: 더 많은 탐색 ── */}
      <section className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-[#0f172a]">
            {isEn
              ? "Shall we diagnose your portfolio through the eyes of 13 investment legends?"
              : "13인 투자 거장의 시선으로 내 보유 종목을 진단해 볼까요?"}
          </h3>
          <p className="text-xs sm:text-sm text-[#64748b]">
            {isEn
              ? "Check intrinsic fair value bands and margin of safety entry prices to start disciplined investing."
              : "적정 내재가치 밴드와 안전마진 가격을 확인하고, 흔들림 없는 원칙 투자를 시작하세요."}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onSelectSection?.("sec-reports")}
            className="px-4 py-2.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white font-mono text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            {isEn ? "Explore Valuation Rankings" : "전체 가치평가 랭킹 보기"}
          </button>
          <button
            onClick={() => onSelectSection?.("sec-screener")}
            className="px-4 py-2.5 rounded-xl border border-[#cbd5e1] hover:border-[#0f172a] bg-white text-[#0f172a] font-mono text-xs font-semibold shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {isEn ? "Open Live Screener" : "실시간 스크리너 열기"}
          </button>
        </div>
      </section>
    </div>
  );
}
