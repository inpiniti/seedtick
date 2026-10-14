"use client";

import React, { useState } from "react";
import { Mail, Shield, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  signInWithKakao,
  signInWithGoogle,
  signInWithMagicLink,
} from "@/lib/subscription/authHelpers";

import { useSubscription } from "@/lib/subscription/SubscriptionContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { upgradeModalReason } = useSubscription();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      await signInWithKakao();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "카카오 로그인 실패",
      });
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "구글 로그인 실패",
      });
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setMessage({ type: "error", text: "올바른 이메일 주소를 입력해주세요." });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      await signInWithMagicLink(email);
      setMessage({
        type: "success",
        text: "로그인 링크가 전송되었습니다. 이메일 받은편지함을 확인해주세요.",
      });
      setEmail("");
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "이메일 로그인 링크 전송 실패",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="default" className="sm:max-w-md">
      <div className="font-sans">
        {/* aihero 스타일 헤더 */}
        <div className="pb-4 border-b border-[#e2e8f0] mb-5">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#64748b] uppercase tracking-wider mb-1">
            <Shield className="w-3.5 h-3.5 text-[#0f172a]" />
            <span>SeedTick Account & Membership</span>
          </div>
          <h3 className="text-lg font-bold text-[#0f172a] tracking-tight">
            로그인 / 회원가입
          </h3>
          <p className="text-xs text-[#64748b] mt-1">
            {upgradeModalReason
              ? "Pro 멤버십 결제 및 최신 분석 리포트 동기화를 위해 먼저 로그인해 주세요."
              : "계정을 연동하고 Pro 멤버십 권한을 기기 간 안전하게 동기화하세요."}
          </p>
        </div>

        {upgradeModalReason && (
          <div className="mb-4 p-2.5 rounded-md bg-[#f8fafc] border border-[#cbd5e1] text-[11px] font-mono text-[#0f172a] flex items-center justify-between">
            <span className="text-[#64748b]">결제 단계:</span>
            <span className="font-semibold text-right truncate max-w-[240px]">
              로그인 후 Pro 결제창으로 자동 연결됩니다
            </span>
          </div>
        )}

        {message && (
          <div
            className={`p-3 rounded-md mb-4 text-xs font-mono ${
              message.type === "success"
                ? "bg-[#f8fafc] text-emerald-700 border border-emerald-200 flex items-center gap-2"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {message.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* 소셜 로그인 버튼 (aihero 스타일: 흑백 모노톤 기반) */}
        <div className="space-y-2.5">
          {/* 구글 로그인 (화이트 배경 + 다크 보더) */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-md bg-white hover:bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] font-medium text-xs shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span className="font-mono">Google 계정으로 계속하기</span>
          </button>

          {/* 카카오 로그인 (절제된 스타일) */}
          <button
            type="button"
            onClick={handleKakaoLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-md bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-medium text-xs shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.477 2 10.765c0 2.766 1.848 5.19 4.63 6.558l-1.18 4.364c-.104.385.334.69.64.486l5.176-3.428c.243.023.488.035.734.035 5.523 0 10-3.477 10-7.765S17.523 3 12 3z" />
            </svg>
            <span className="font-mono">카카오 계정으로 계속하기</span>
          </button>
        </div>

        {/* 구분선 */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#e2e8f0]" />
          </div>
          <div className="relative flex justify-center text-[10px] font-mono uppercase tracking-wider">
            <span className="bg-white px-2 text-[#94a3b8]">OR EMAIL MAGIC LINK</span>
          </div>
        </div>

        {/* 이메일 매직링크 폼 */}
        <form onSubmit={handleEmailLogin} className="space-y-2.5">
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#94a3b8]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-[#cbd5e1] rounded-md text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-hidden focus:border-[#0f172a]"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-2.5 px-4 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white font-mono text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            이메일 로그인 링크 받기
          </button>
        </form>
      </div>
    </Modal>
  );
}
