"use client";

import React, { useState } from "react";
import { User as UserIcon, LogOut, ShieldCheck, RefreshCw, Sparkles } from "lucide-react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { signOutUser } from "@/lib/subscription/authHelpers";

export function UserProfileWidget() {
  const {
    user,
    tier,
    isTrialActive,
    trialRemainingHours,
    subscription,
    openUpgradeModal,
    openAuthModal,
    toggleTierForTesting,
  } = useSubscription();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isPro = tier === "pro";

  const expiryDateFormatted = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : null;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* 개발 / 데모용 Free <-> Pro 즉시 전환 토글 (aihero 스타일) */}
      <button
        type="button"
        onClick={toggleTierForTesting}
        title="클릭하여 Free와 Pro 모드를 즉시 전환해볼 수 있습니다."
        className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors border border-[#e2e8f0] cursor-pointer"
      >
        <RefreshCw className="w-2.5 h-2.5" />
        <span>MODE: {isPro ? "PRO" : isTrialActive ? "1-DAY TRIAL" : "FREE"}</span>
      </button>

      {/* 상태별 CTA 배지 및 버튼 */}
      {isPro ? (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0f172a] text-white border border-[#0f172a] text-xs font-mono font-semibold">
          <ShieldCheck className="w-3 h-3" />
          <span>PRO MEMBER</span>
          {expiryDateFormatted && (
            <span className="text-[10px] text-slate-300 font-normal hidden md:inline">
              (~{expiryDateFormatted})
            </span>
          )}
        </div>
      ) : isTrialActive ? (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white text-[#0f172a] border border-[#0f172a] text-xs font-mono font-medium shadow-2xs">
          <span className="font-semibold">TRIAL</span>
          <span className="text-[10px] text-[#64748b]">
            ({trialRemainingHours}h left)
          </span>
        </div>
      ) : !user ? (
        <button
          type="button"
          onClick={openAuthModal}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-mono font-medium shadow-2xs transition-colors cursor-pointer"
        >
          <Sparkles className="w-3 h-3 text-white" />
          <span>24H 무료 체험</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => openUpgradeModal()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-mono font-medium shadow-2xs transition-colors cursor-pointer"
        >
          <Sparkles className="w-3 h-3" />
          <span>PRO UPGRADE (2,900원)</span>
        </button>
      )}

      {/* 유저 로그인 상태 */}
      {user ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 p-1 rounded-md border border-[#e2e8f0] hover:border-[#cbd5e1] hover:bg-[#f8fafc] text-[#0f172a] transition-colors text-xs font-mono cursor-pointer"
          >
            <div className="w-6 h-6 rounded bg-[#0f172a] text-white flex items-center justify-center font-bold text-[10px] uppercase overflow-hidden">
              {user.email ? user.email.slice(0, 2).toUpperCase() : <UserIcon className="w-3 h-3" />}
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-md shadow-xl border border-[#cbd5e1] p-2 z-50 text-xs font-mono">
              <div className="px-2.5 py-2 border-b border-[#e2e8f0] mb-1">
                <p className="font-semibold text-[#0f172a] truncate">{user.email}</p>
                <div className="flex items-center justify-between text-[11px] text-[#64748b] mt-1">
                  <span>TIER:</span>
                  <strong className={isPro || isTrialActive ? "text-[#0f172a]" : "text-[#64748b]"}>
                    {isPro ? "PRO" : isTrialActive ? "1-DAY TRIAL" : "FREE"}
                  </strong>
                </div>
                {isPro && expiryDateFormatted && (
                  <p className="text-[10px] text-[#94a3b8] mt-0.5">
                    EXPIRES: {expiryDateFormatted}
                  </p>
                )}
                {isTrialActive && (
                  <p className="text-[10px] text-[#64748b] mt-0.5">
                    체험 종료까지: 약 {trialRemainingHours}시간 남음
                  </p>
                )}
              </div>

              {!isPro && (
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    openUpgradeModal();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-[#0f172a] font-medium hover:bg-[#f1f5f9] flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  Pro 요금제 업그레이드
                </button>
              )}

              <button
                onClick={async () => {
                  setIsDropdownOpen(false);
                  await signOutUser();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3 h-3" />
                로그아웃
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={openAuthModal}
          className="px-2.5 py-1.5 rounded-md border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#0f172a] text-xs font-mono font-medium transition-colors cursor-pointer shadow-2xs"
        >
          로그인
        </button>
      )}
    </div>
  );
}
