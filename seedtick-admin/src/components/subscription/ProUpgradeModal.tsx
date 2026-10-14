"use client";

import React, { useState } from "react";
import { Check, Shield, CreditCard, Lock, UserCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { PRICING_PLANS } from "@/lib/subscription/types";

export function ProUpgradeModal() {
  const {
    user,
    isUpgradeModalOpen,
    closeUpgradeModal,
    upgradeModalReason,
    upgradeToPro,
    openAuthModal,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isUpgradeModalOpen) return null;

  const handlePay = async () => {
    // 1. 비로그인 상태인 경우: 로그인 모달 먼저 오픈
    if (!user) {
      closeUpgradeModal();
      openAuthModal();
      return;
    }

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
    <Modal isOpen={isUpgradeModalOpen} onClose={closeUpgradeModal} size="default" className="sm:max-w-lg">
      <div className="font-sans">
        {/* aihero 스타일 헤더 */}
        <div className="pb-4 border-b border-[#e2e8f0] mb-5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#0f172a]" />
              <span>MEMBERSHIP ACCESS GATE</span>
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#0f172a] bg-[#0f172a] text-white">
              SEEDTICK PRO
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] tracking-tight">
            {upgradeModalReason?.includes("무료 체험")
              ? "어제 무료 체험은 유익하셨나요?"
              : "13인 투자 거장 AI 종합 분석 리포트"}
          </h3>
          <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
            {upgradeModalReason ||
              "1일 무료 체험이 종료되었어요. 매일 실시간으로 업데이트되는 13인 거장 AI 가치평가와 심층 데이터팩을 계속 받아보시려면 Pro로 시작해보세요."}
          </p>
        </div>

        <div className="space-y-4">
          {/* 플랜 선택 탭 (aihero 흑백 모노톤 세그먼트) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#f1f5f9] rounded-md font-mono text-xs">
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              className={`py-2 px-3 rounded transition-colors text-center cursor-pointer ${
                selectedPlan === "monthly"
                  ? "bg-[#0f172a] text-white font-medium shadow-2xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              월간 플랜 (2,900원/월)
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan("yearly")}
              className={`py-2 px-3 rounded transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                selectedPlan === "yearly"
                  ? "bg-[#0f172a] text-white font-medium shadow-2xs"
                  : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <span>연간 플랜 (29,000원)</span>
              <span className="text-[10px] px-1 rounded bg-white text-[#0f172a] border border-[#cbd5e1] font-semibold">
                17% 할인
              </span>
            </button>
          </div>

          {/* 가격 카드 (흑백 테크니컬 리서치 스타일) */}
          <div className="p-4 rounded-md bg-[#f8fafc] border border-[#cbd5e1] flex items-center justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase text-[#64748b] block mb-0.5">
                TIER PRICING · {plan.name}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-2xl sm:text-3xl font-bold text-[#0f172a]">
                  {plan.price.toLocaleString()}원
                </span>
                <span className="font-mono text-xs text-[#64748b]">
                  {plan.periodLabel}
                </span>
                {plan.originalPrice && (
                  <span className="font-mono text-xs text-[#94a3b8] line-through ml-1">
                    {plan.originalPrice.toLocaleString()}원
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#64748b] mt-1 font-mono">
                {selectedPlan === "monthly"
                  ? "하루 약 96원 · 언제든 1초 만에 위약금 없이 해지 가능"
                  : "2개월 무료 이용 혜택 · 1년 동안 가격 인상 없음"}
              </p>
            </div>
            <span className="font-mono text-xs px-2 py-1 rounded border border-[#cbd5e1] bg-white text-[#0f172a] shrink-0 font-medium">
              {selectedPlan === "monthly" ? "정기 결제" : "1년 이용권"}
            </span>
          </div>

          {/* 포함 혜택 리스트 */}
          <div className="space-y-2 border border-[#e2e8f0] rounded-md p-3.5 bg-white text-xs">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8] block mb-1.5">
              INCLUDED SPECIFICATIONS
            </span>
            <ul className="space-y-1.5 text-[#334155]">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0f172a] shrink-0 mt-0.5" />
                <span>
                  <strong>최근 1개월 최신 리포트</strong> 실시간 전체 열람 권한 부여
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0f172a] shrink-0 mt-0.5" />
                <span>13인 전설적 투자 거장 AI 합의 표결 및 내재가치 밴드</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-[#0f172a] shrink-0 mt-0.5" />
                <span>SEC 공시 원문 기반 실시간 정량/정성 심층 재무 데이터팩</span>
              </li>
            </ul>
          </div>

          {/* 로그인 계정 연동 상태 안내 */}
          {user ? (
            <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-[#0f172a]">
                <UserCheck className="w-4 h-4 text-[#0f172a]" />
                <span className="truncate max-w-[240px]">{user.email}</span>
              </div>
              <span className="text-[10px] text-[#64748b]">계정 연결됨</span>
            </div>
          ) : (
            <div className="p-3 rounded-md bg-[#f8fafc] border border-[#cbd5e1] text-xs font-mono text-[#0f172a] flex items-center justify-between">
              <span className="text-[#64748b]">* 결제 전 계정 로그인(Google)이 필요합니다.</span>
              <button
                type="button"
                onClick={() => {
                  closeUpgradeModal();
                  openAuthModal();
                }}
                className="underline font-semibold text-[#0f172a] hover:text-black cursor-pointer"
              >
                지금 로그인
              </button>
            </div>
          )}

          {/* 결제 방식 안내 */}
          <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-[#0f172a]">
              <CreditCard className="w-3.5 h-3.5 text-[#64748b]" />
              <span>
                {selectedPlan === "monthly"
                  ? "신용카드 자동 정기결제 (매달 자동 갱신)"
                  : "신용 / 체크카드 결제 (1년 이용권)"}
              </span>
            </div>
            <span className="text-[10px] text-[#94a3b8]">포트원 보안결제</span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-md bg-rose-50 text-rose-700 text-xs font-mono border border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* 하단 CTA 버튼 */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={closeUpgradeModal}
              className="flex-1 py-2.5 px-3 rounded-md border border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] text-xs font-mono font-medium transition-colors cursor-pointer"
            >
              과거 무료 보고서 보기 (닫기)
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={isSubmitting}
              className="flex-[1.5] py-2.5 px-4 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-mono font-medium shadow-2xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>결제창 연결 중...</span>
              ) : !user ? (
                <span>로그인 후 Pro 시작하기</span>
              ) : (
                <span>Pro 시작하기 ({plan.price.toLocaleString()}원)</span>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-[#94a3b8]">
            <Shield className="w-3 h-3" />
            <span>포트원 공식 전자결제 · 결제 즉시 마감일까지 Pro 혜택 유지</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
