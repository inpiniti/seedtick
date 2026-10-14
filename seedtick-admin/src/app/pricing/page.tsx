"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Sparkles, Zap, Shield, HelpCircle } from "lucide-react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { PRICING_PLANS } from "@/lib/subscription/types";

export default function PricingPage() {
  const { tier, openUpgradeModal } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");

  const isPro = tier === "pro";
  const plan = PRICING_PLANS[selectedPlan];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* 상단 네비게이션 */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>SeedTick Research 홈으로</span>
          </Link>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
            {isPro ? "💎 현재 Pro 회원 이용 중" : "🌱 현재 Free 멤버십"}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-12">
        {/* 헤더 */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SeedTick Membership</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            합리적인 가격으로 거장의 통찰을 내 손에
          </h1>
          <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
            13인의 전설적 투자 거장 AI 합의 표결과 SEC 공시 정밀 분석 리포트를 실시간으로 확인하세요.
          </p>

          {/* 월간 / 연간 토글 */}
          <div className="mt-8 inline-flex items-center p-1 bg-slate-200/80 rounded-2xl">
            <button
              onClick={() => setSelectedPlan("monthly")}
              className={`py-2 px-5 rounded-xl text-sm font-bold transition-all ${
                selectedPlan === "monthly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              월간 구독 (2,900원/월)
            </button>
            <button
              onClick={() => setSelectedPlan("yearly")}
              className={`py-2 px-5 rounded-xl text-sm font-bold transition-all relative ${
                selectedPlan === "yearly"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              연간 구독 (29,000원/년)
              <span className="ml-1.5 text-[10px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                2달 무료
              </span>
            </button>
          </div>
        </div>

        {/* 2단 플랜 비교 카드 */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
          {/* Free 플랜 */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold mb-4">
                무료 체험
              </div>
              <h2 className="text-2xl font-bold text-slate-900">SeedTick Free</h2>
              <p className="text-slate-500 text-xs mt-1 mb-6">
                기본 가치평가 및 과거 아카이브를 무료로 탐색하세요
              </p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-slate-900">0원</span>
                <span className="text-slate-400 text-sm">/ 평생 무료</span>
              </div>

              <ul className="space-y-3 text-sm text-slate-600 border-t border-slate-100 pt-6">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>13인 거장 AI 가치평가 아카이브 (1개월 이전)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>실시간 가치주 스크리너 및 시그널</span>
                </li>
                <li className="flex items-center gap-2.5 text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">✕</span>
                  <span className="line-through">최근 1개월 최신 분석 리포트 열람</span>
                </li>
                <li className="flex items-center gap-2.5 text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">✕</span>
                  <span className="line-through">실시간 SEC 공시 데이터팩 업데이트</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <span className="block text-center text-xs font-semibold text-slate-400 py-3">
                현재 기본 제공 중
              </span>
            </div>
          </div>

          {/* Pro 플랜 (하이라이트) */}
          <div className="bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl p-8 border border-indigo-700/40 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold mb-4">
                <Sparkles className="w-3 h-3" />
                <span>{plan.badge}</span>
              </div>
              <h2 className="text-2xl font-bold text-white">SeedTick Pro</h2>
              <p className="text-slate-300 text-xs mt-1 mb-6">
                매일 업데이트되는 13인 거장의 최신 투자 보고서 무제한
              </p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-white">
                  {plan.price.toLocaleString()}원
                </span>
                <span className="text-indigo-200 text-sm">{plan.periodLabel}</span>
                {plan.originalPrice && (
                  <span className="text-xs text-slate-400 line-through ml-2">
                    {plan.originalPrice.toLocaleString()}원
                  </span>
                )}
              </div>

              <ul className="space-y-3 text-sm text-slate-200 border-t border-white/10 pt-6">
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>
                    <strong>최근 1개월 최신 분석 리포트</strong> 제한 없이 실시간 무제한
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>13인의 투자 거장 AI 합의 표결 및 내재가치 밴드</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>SEC 공시 원문 기반 실시간 심층 재무 데이터팩</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>카드 정기결제 등록 시 언제든 1초 만에 위약금 없이 해지</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => openUpgradeModal()}
                className="w-full py-4 px-6 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                <span>
                  {isPro
                    ? "멤버십 기간 연장하기"
                    : `지금 시작하기 (${plan.price.toLocaleString()}원)`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 신뢰 & 보안 안내 */}
        <div className="max-w-2xl mx-auto text-center text-xs text-slate-500 space-y-1">
          <div className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <Shield className="w-4 h-4 text-indigo-600" />
            <span>포트원(PortOne) 공식 전자결제 암호화 보안 시스템</span>
          </div>
          <p>
            구독 중 언제든 해지 가능하며, 이미 결제된 이용 기간까지는 Pro 혜택이 정상 유지됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
