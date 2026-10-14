"use client";

import React, { useState } from "react";
import { Check, Sparkles, X, Shield, Zap, CreditCard, Lock } from "lucide-react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { PRICING_PLANS } from "@/lib/subscription/types";

export function ProUpgradeModal() {
  const {
    isUpgradeModalOpen,
    closeUpgradeModal,
    upgradeModalReason,
    upgradeToPro,
    tier,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isUpgradeModalOpen) return null;

  const handlePay = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await upgradeToPro(selectedPlan, "card");
      if (!res.success) {
        setErrorMsg(res.message || "결제 진행 중 문제가 발생했습니다.");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "결제 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const plan = PRICING_PLANS[selectedPlan];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
        role="dialog"
        aria-modal="true"
      >
        {/* 상단 닫기 버튼 */}
        <button
          onClick={closeUpgradeModal}
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 상단 헤더 배너 (토스 스타일 그라디언트) */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>SeedTick Research Pro</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            13인 투자 거장의 최신 AI 분석 리포트
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            {upgradeModalReason ||
              "최근 1개월간 발행된 최신 심층 리포트와 실시간 가치평가는 Pro 회원 전용 콘텐츠입니다."}
          </p>
        </div>

        {/* 바디 영역 */}
        <div className="p-6 space-y-6">
          {/* 플랜 선택 탭 (토스 스타일 세그먼트) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              className={`py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                selectedPlan === "monthly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              월간 플랜 (매월 2,900원)
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan("yearly")}
              className={`relative py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                selectedPlan === "yearly"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              연간 플랜 (29,000원)
              <span className="ml-1.5 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                17% 할인
              </span>
            </button>
          </div>

          {/* 가격 카드 */}
          <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-indigo-600 block mb-0.5">
                {plan.badge}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {plan.price.toLocaleString()}원
                </span>
                <span className="text-slate-500 text-sm font-medium">
                  {plan.periodLabel}
                </span>
                {plan.originalPrice && (
                  <span className="text-xs text-slate-400 line-through ml-2">
                    {plan.originalPrice.toLocaleString()}원
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {selectedPlan === "monthly"
                  ? "하루 약 96원 · 언제든 위약금 없이 1초 해지"
                  : "2개월 무료 혜택 · 1년 동안 가격 인상 없음"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <Zap className="w-6 h-6" />
            </div>
          </div>

          {/* 주요 혜택 리스트 */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              포함된 핵심 혜택
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2.5">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>
                  <strong>최근 1개월 최신 리포트</strong> 제한 없이 실시간 무제한 열람
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>
                  13인의 전설적 투자 거장 AI 합의 표결 및 내재가치 밴드
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>
                  SEC 공시 원문 기반 실시간 정량/정성 심층 재무 데이터팩
                </span>
              </li>
            </ul>
          </div>

          {/* 결제 수단 안내 (통합 카드/페이 결제) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <span>
                {selectedPlan === "monthly"
                  ? "신용카드 자동 정기결제 (매월 자동 갱신)"
                  : "신용 / 체크카드 결제 (1년 이용권)"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">안전 암호화</span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium border border-rose-100">
              {errorMsg}
            </div>
          )}

          {/* 하단 CTA 버튼 (토스 스타일) */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={closeUpgradeModal}
              className="flex-1 py-3.5 px-4 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              과거 보고서만 볼래요 (취소)
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={isSubmitting}
              className="flex-[1.4] py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>결제창 연결 중...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Pro 시작하기 ({plan.price.toLocaleString()}원)</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5" />
            <span>포트원 보안 암호화 결제 · 결제 즉시 마감일까지 Pro가 유지됩니다</span>
          </div>
        </div>
      </div>
    </div>
  );
}
