"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User as UserIcon, LogOut, ShieldCheck, Sparkles, Clock, Settings } from "lucide-react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { signOutUser } from "@/lib/subscription/authHelpers";
import { IS_OPEN_BETA } from "@/lib/subscription/subscriptionPolicy";

export function UserProfileWidget() {
  const {
    user,
    tier,
    isTrialActive,
    trialRemainingHours,
    subscription,
    openUpgradeModal,
    openAuthModal,
  } = useSubscription();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const isPro = tier === "pro";

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ||
    (user?.user_metadata?.picture as string | undefined) ||
    null;

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "사용자";

  // 드롭다운 바깥 클릭 시 닫기
  React.useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const expiryDateFormatted = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : null;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* 상태별 CTA 배지 및 버튼 (오픈 베타 모드 우선 분기) */}
      {IS_OPEN_BETA ? (
        !user ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-medium"
            title="오픈 베타 서비스 기간 동안 로그인이나 결제 없이 모든 리포트를 무료로 이용하실 수 있습니다."
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">오픈 베타 · 로그인 없이 전면 무료</span>
            <span className="sm:hidden">오픈베타 무료</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>BETA MEMBER</span>
          </span>
        )
      ) : isPro ? (
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white border border-[#0f172a] text-xs font-mono font-semibold transition-colors"
        >
          <ShieldCheck className="w-3 h-3" />
          <span>PRO MEMBER</span>
          {expiryDateFormatted && (
            <span className="text-[10px] text-slate-300 font-normal hidden md:inline">
              (~{expiryDateFormatted})
            </span>
          )}
        </Link>
      ) : isTrialActive ? (
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white border border-[#0f172a] text-xs font-mono font-semibold transition-colors"
        >
          <Clock className="w-3 h-3" />
          <span>TRIAL MEMBER</span>
          <span className="text-[10px] text-slate-300 font-normal hidden md:inline">
            ({trialRemainingHours}h left)
          </span>
        </Link>
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

      {/* 유저 로그인 상태: 구글 계정 원형 아바타 */}
      {user ? (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-8 h-8 rounded-full border border-[#cbd5e1] hover:border-[#0f172a] focus:outline-hidden focus:ring-2 focus:ring-[#0f172a]/20 transition-all cursor-pointer p-0.5 bg-white flex items-center justify-center shrink-0 shadow-2xs"
            aria-label="사용자 계정 메뉴"
          >
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-[#f8fafc]">
              {avatarUrl && !imageError ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  onError={() => setImageError(true)}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#0f172a] text-white flex items-center justify-center font-bold text-[11px] uppercase">
                  {displayName ? displayName.slice(0, 1).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                </div>
              )}
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-[#cbd5e1] p-3 z-50 text-xs font-mono animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#e2e8f0] mb-2">
                <div className="w-9 h-9 rounded-full border border-[#cbd5e1] overflow-hidden shrink-0 bg-[#f8fafc] flex items-center justify-center">
                  {avatarUrl && !imageError ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#0f172a] text-white flex items-center justify-center font-bold text-sm uppercase">
                      {displayName ? displayName.slice(0, 1).toUpperCase() : <UserIcon className="w-4 h-4" />}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#0f172a] truncate text-xs">{displayName}</p>
                  <p className="text-[11px] text-[#64748b] truncate">{user.email}</p>
                </div>
              </div>

              <div className="px-1 py-1 text-[11px] text-[#64748b] flex items-center justify-between mb-1">
                <span>TIER:</span>
                <strong className={isPro || isTrialActive ? "text-[#0f172a]" : "text-[#64748b]"}>
                  {isPro ? "PRO" : isTrialActive ? "1-DAY TRIAL" : "FREE"}
                </strong>
              </div>
              {isPro && expiryDateFormatted && (
                <p className="text-[10px] text-[#94a3b8] px-1 mb-2">
                  EXPIRES: {expiryDateFormatted}
                </p>
              )}
              {isTrialActive && (
                <p className="text-[10px] text-[#64748b] px-1 mb-2">
                  체험 종료까지: 약 {trialRemainingHours}시간 남음
                </p>
              )}

              <div className="border-t border-[#e2e8f0] pt-1.5 space-y-0.5">
                <Link
                  href="/account"
                  onClick={() => setIsDropdownOpen(false)}
                  className="w-full text-left px-2 py-1.5 rounded text-[#0f172a] hover:bg-[#f1f5f9] flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-3 h-3 text-[#64748b]" />
                  멤버십 관리
                </Link>

                {!isPro && (
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      openUpgradeModal();
                    }}
                    className="w-full text-left px-2 py-1.5 rounded text-[#0f172a] font-medium hover:bg-[#f1f5f9] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-[#0f172a]" />
                    Pro 요금제 업그레이드
                  </button>
                )}

                <button
                  onClick={async () => {
                    setIsDropdownOpen(false);
                    await signOutUser();
                  }}
                  className="w-full text-left px-2 py-1.5 rounded text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3 h-3 text-rose-600" />
                  로그아웃
                </button>
              </div>
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
