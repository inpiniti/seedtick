"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, CheckCircle2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { signInWithGoogle } from "@/lib/subscription/authHelpers";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "구글 로그인에 실패했습니다. 다시 시도해주세요."
      );
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="default" className="sm:max-w-md">
      <div className="font-sans">
        {/* 모노톤 웰컴 헤더 */}
        <div className="pb-4 border-b border-[#e2e8f0] mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#0f172a]" />
              <span>REPORTIST WELCOME PASS</span>
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#0f172a] bg-[#0f172a] text-white font-medium flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              <span>24H TRIAL PASS</span>
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#0f172a] tracking-tight">
            로그인하고 오늘 하루 무료로 둘러보세요
          </h3>
          <p className="text-xs text-[#64748b] mt-1.5 leading-relaxed">
            가입 즉시 24시간 동안 13인 투자 거장 AI 실시간 리포트와 SEC 공시 데이터팩을 카드 등록 없이 무료로 열람하실 수 있어요.
          </p>
        </div>

        {/* 웰컴 혜택 안내 박스 */}
        <div className="mb-5 p-3.5 rounded-lg bg-[#f8fafc] border border-[#cbd5e1] text-xs font-mono space-y-1.5">
          <div className="flex items-center gap-2 text-[#0f172a] font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0f172a] shrink-0" />
            <span>카드 등록 없이 구글 원클릭 시작</span>
          </div>
          <p className="text-[#64748b] text-[11px] pl-5.5 leading-relaxed">
            24시간 동안 모든 유료 기능을 충분히 이용해보시고, 내일부터 계속 이용할지 천천히 결정하세요.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-md mb-4 text-xs font-mono bg-rose-50 text-rose-700 border border-rose-200">
            {errorMessage}
          </div>
        )}

        {/* 구글 전용 원클릭 로그인 버튼 */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-white hover:bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] hover:border-[#0f172a] font-medium text-xs shadow-2xs hover:shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.09C3.29 21.43 7.37 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.41l4.02-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.57 1.26 6.59l4.02 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
              />
            </svg>
            <span className="font-mono font-semibold text-[13px]">
              {isLoading ? "로그인 중..." : "Google 계정으로 계속하기"}
            </span>
          </button>

          <p className="text-[10px] text-center text-[#94a3b8] font-mono leading-tight pt-1">
            계속 진행 시 Reportist의{" "}
            <Link href="/terms" onClick={onClose} className="underline hover:text-[#0f172a]">
              이용약관
            </Link>{" "}
            및{" "}
            <Link href="/privacy" onClick={onClose} className="underline hover:text-[#0f172a]">
              개인정보처리방침
            </Link>
            에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </Modal>
  );
}
