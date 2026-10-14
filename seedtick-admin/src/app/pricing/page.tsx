"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Shield, Lock } from "lucide-react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { PRICING_PLANS } from "@/lib/subscription/types";

export default function PricingPage() {
  const { user, tier, openUpgradeModal, openAuthModal } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");

  const isPro = tier === "pro";
  const plan = PRICING_PLANS[selectedPlan];

  const handleStartPro = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    openUpgradeModal();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans pb-24">
      {/* 상단 네비게이션 바 (aihero 스타일 미니멀 흑백 헤더) */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>SEEDTICK RESEARCH 홈으로</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md border border-[#cbd5e1] bg-white text-[#0f172a]">
              {isPro ? "● PRO ACTIVE" : "○ FREE TIER"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-10 sm:pt-14">
        {/* 헤더 섹션 */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#cbd5e1] text-[#64748b] text-[11px] font-mono mb-3">
            <Lock className="w-3 h-3 text-[#0f172a]" />
            <span>MEMBERSHIP SPECIFICATIONS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
            13인 거장 AI 종합 분석 리서치 멤버십
          </h1>
          <p className="mt-2 text-[#64748b] text-xs sm:text-sm font-mono leading-relaxed">
            단순한 주가 시세판이 아닌, 투자 거장 13인의 독자적 밸류에이션 리포트와 SEC 공시 심층 데이터를 실시간으로 열람하세요.
          </p>

          {/* 월간 / 연간 흑백 토글 */}
          <div className="mt-6 inline-flex items-center p-1 bg-[#f1f5f9] rounded-md border border-[#e2e8f0] font-mono text-xs">
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              className={`py-1.5 px-4 rounded-md transition-colors cursor-pointer ${
                selectedPlan === "monthly"
                  ? "bg-[#0f172a] text-white font-medium shadow-2xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              월간 구독 (2,900원/월)
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan("yearly")}
              className={`py-1.5 px-4 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedPlan === "yearly"
                  ? "bg-[#0f172a] text-white font-medium shadow-2xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <span>연간 구독 (29,000원/년)</span>
              <span
                className={`text-[10px] px-1 rounded ${
                  selectedPlan === "yearly"
                    ? "bg-white text-[#0f172a] font-semibold"
                    : "bg-[#e2e8f0] text-[#0f172a]"
                }`}
              >
                17% 할인
              </span>
            </button>
          </div>
        </div>

        {/* 2단 플랜 비교 카드 (aihero 흑백 모노톤) */}
        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto mb-12">
          {/* Free 플랜 */}
          <div className="bg-white rounded-md p-6 border border-[#cbd5e1] shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 font-mono text-[11px]">
                <span className="text-[#64748b] uppercase tracking-wider">TIER 01</span>
                <span className="px-1.5 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]">
                  BASIC ARCHIVE
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#0f172a] tracking-tight">
                SeedTick Free
              </h2>
              <p className="text-[#64748b] text-xs font-mono mt-1 mb-5">
                기본 가치평가 및 1개월 이전 과거 아카이브 무료 열람
              </p>

              <div className="flex items-baseline gap-1.5 mb-6 pb-5 border-b border-[#e2e8f0]">
                <span className="font-mono text-3xl font-bold text-[#0f172a]">0원</span>
                <span className="font-mono text-xs text-[#94a3b8]">/ 평생 무료</span>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-mono text-[10px] text-[#94a3b8] uppercase tracking-wider block mb-1">
                  PLAN SPECIFICATIONS
                </span>
                <ul className="space-y-2 font-mono text-[#334155]">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#0f172a] shrink-0 mt-0.5" />
                    <span>13인 거장 AI 가치평가 아카이브 (1개월 이전 과거 리포트)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#0f172a] shrink-0 mt-0.5" />
                    <span>실시간 가치주 스크리너 및 시그널 모니터링</span>
                  </li>
                  <li className="flex items-start gap-2 text-[#94a3b8]">
                    <X className="w-3.5 h-3.5 text-[#cbd5e1] shrink-0 mt-0.5" />
                    <span className="line-through">최근 1개월 최신 분석 리포트 열람</span>
                  </li>
                  <li className="flex items-start gap-2 text-[#94a3b8]">
                    <X className="w-3.5 h-3.5 text-[#cbd5e1] shrink-0 mt-0.5" />
                    <span className="line-through">실시간 SEC 공시 데이터팩 업데이트</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-[#e2e8f0]">
              <div className="w-full py-2.5 px-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-center text-xs font-mono text-[#64748b]">
                현재 기본 제공 중
              </div>
            </div>
          </div>

          {/* Pro 플랜 (블랙 하이라이트 카드) */}
          <div className="bg-[#0f172a] text-white rounded-md p-6 border border-[#0f172a] shadow-xl flex flex-col justify-between relative">
            <div>
              <div className="flex items-center justify-between mb-3 font-mono text-[11px]">
                <span className="text-slate-400 uppercase tracking-wider">TIER 02</span>
                <span className="px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-200">
                  {plan.badge}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                SeedTick Pro
              </h2>
              <p className="text-slate-400 text-xs font-mono mt-1 mb-5">
                매일 업데이트되는 13인 거장의 최신 투자 리포트 무제한 열람
              </p>

              <div className="flex items-baseline gap-1.5 mb-6 pb-5 border-b border-slate-800">
                <span className="font-mono text-3xl font-bold text-white">
                  {plan.price.toLocaleString()}원
                </span>
                <span className="font-mono text-xs text-slate-400">{plan.periodLabel}</span>
                {plan.originalPrice && (
                  <span className="font-mono text-xs text-slate-500 line-through ml-1.5">
                    {plan.originalPrice.toLocaleString()}원
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  FULL SPECIFICATIONS
                </span>
                <ul className="space-y-2 font-mono text-slate-200">
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">최근 1개월 최신 분석 리포트</strong> 실시간 전체 열람
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                    <span>13인 전설적 투자 거장 AI 독립 표결 및 적정가치 밴드</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                    <span>SEC 공시 원문 기반 실시간 심층 재무 데이터팩</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                    <span>카드 정기결제 시 언제든 1초 만에 위약금 없이 해지 가능</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-800">
              <button
                type="button"
                onClick={handleStartPro}
                className="w-full py-2.5 px-4 rounded-md bg-white hover:bg-slate-100 text-[#0f172a] font-mono text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {!user ? (
                  <span>로그인 후 Pro 시작하기</span>
                ) : isPro ? (
                  <span>멤버십 이용 중 (설정 관리)</span>
                ) : (
                  <span>Pro 시작하기 ({plan.price.toLocaleString()}원)</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 신뢰 & 보안 안내 (aihero 흑백 풋터) */}
        <div className="max-w-xl mx-auto text-center text-xs font-mono text-[#64748b] space-y-1.5 border-t border-[#e2e8f0] pt-6">
          <div className="inline-flex items-center gap-1.5 text-[#0f172a] font-medium">
            <Shield className="w-3.5 h-3.5 text-[#0f172a]" />
            <span>포트원(PortOne) 공식 전자결제 암호화 보안 시스템</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            신용카드 자동 정기결제는 매달 동일한 날짜에 갱신되며, 언제든 해지 신청 시 결제된 마감일까지 Pro 혜택이 정상 유지됩니다.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3 text-[11px] text-[#94a3b8]">
            <Link href="/privacy" className="hover:text-[#0f172a] underline decoration-slate-300">
              개인정보처리방침
            </Link>
            <span>·</span>
            <Link href="/terms" className="hover:text-[#0f172a] underline decoration-slate-300">
              서비스 이용약관
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
