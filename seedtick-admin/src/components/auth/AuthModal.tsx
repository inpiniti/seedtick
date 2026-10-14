"use client";

import React, { useState } from "react";
import { Mail, Shield, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
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
        {/* aihero 스타일 모노톤 헤더 */}
        <div className="pb-4 border-b border-[#e2e8f0] mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748b] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#0f172a]" />
              <span>SEEDTICK WELCOME PASS</span>
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#0f172a] bg-[#0f172a] text-white font-medium">
              24H TRIAL PASS
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#0f172a] tracking-tight">
            로그인하고 오늘 하루 무료로 둘러보세요
          </h3>
          <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
            가입 즉시 24시간 동안 13인 투자 거장 AI 실시간 리포트와 SEC 공시 데이터팩을 결제 없이 마음껏 열람하실 수 있어요.
          </p>
        </div>

        {/* 웰컴 혜택 안내 박스 (모노톤) */}
        <div className="mb-4 p-3 rounded-md bg-[#f8fafc] border border-[#cbd5e1] text-xs font-mono space-y-1">
          <div className="flex items-center gap-2 text-[#0f172a] font-semibold text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0f172a] shrink-0" />
            <span>카드 등록 없이 원클릭 간편 로그인</span>
          </div>
          <p className="text-[#64748b] text-[11px] pl-5.5 leading-relaxed">
            오늘 24시간 동안 충분히 써보시고, 내일부터 계속 이용할지 천천히 결정하세요.
          </p>
        </div>

        {message && (
          <div
            className={`p-3 rounded-md mb-4 text-xs font-mono ${
              message.type === "success"
                ? "bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] flex items-center gap-2"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {message.type === "success" && <CheckCircle2 className="w-4 h-4 text-[#0f172a] shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* 소셜 로그인 버튼 (흑백 모노톤 기반) */}
        <div className="space-y-2.5">
          {/* 구글 로그인 */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-md bg-white hover:bg-[#f8fafc] text-[#0f172a] border border-[#cbd5e1] font-medium text-xs shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4 fill-current text-[#0f172a]" viewBox="0 0 24 24">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
            <span className="font-mono">Google 계정으로 계속하기</span>
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
