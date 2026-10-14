"use client";

import React, { useState } from "react";
import { Sparkles, User as UserIcon, LogOut, ShieldCheck, RefreshCw } from "lucide-react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { signOutUser } from "@/lib/subscription/authHelpers";
import { AuthModal } from "@/components/auth/AuthModal";

export function UserProfileWidget() {
  const {
    user,
    tier,
    subscription,
    openUpgradeModal,
    toggleTierForTesting,
  } = useSubscription();

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isPro = tier === "pro";

  const expiryDateFormatted = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* 개발 / 데모용 Free <-> Pro 즉시 전환 토글 (사용자 편의) */}
        <button
          type="button"
          onClick={toggleTierForTesting}
          title="클릭하여 Free와 Pro 모드를 즉시 전환해볼 수 있습니다."
          className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          <span>모드: {isPro ? "Pro" : "Free"}</span>
        </button>

        {/* Pro 업그레이드 CTA 버튼 (Free 유저일 때 강조 표시) */}
        {!isPro ? (
          <button
            type="button"
            onClick={() => openUpgradeModal()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-sm shadow-indigo-200 transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pro 업그레이드 (월 2,900원)</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Pro 회원</span>
            {expiryDateFormatted && (
              <span className="text-[10px] font-normal text-indigo-500 hidden md:inline">
                (~{expiryDateFormatted})
              </span>
            )}
          </div>
        )}

        {/* 유저 로그인 상태 */}
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors text-xs font-medium"
            >
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                {user.email ? user.email.slice(0, 2) : <UserIcon className="w-4 h-4" />}
              </div>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-slate-900 truncate">{user.email}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    멤버십: <strong className={isPro ? "text-indigo-600" : "text-slate-600"}>{isPro ? "Pro" : "Free"}</strong>
                  </p>
                  {isPro && expiryDateFormatted && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      만료 예정일: {expiryDateFormatted}
                    </p>
                  )}
                </div>

                {!isPro && (
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      openUpgradeModal();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-indigo-600 font-semibold hover:bg-indigo-50 flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Pro 요금제 업그레이드
                  </button>
                )}

                <button
                  onClick={async () => {
                    setIsDropdownOpen(false);
                    await signOutUser();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAuthOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            로그인
          </button>
        )}
      </div>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
