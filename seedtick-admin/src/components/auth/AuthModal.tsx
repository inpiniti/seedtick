"use client";

import React, { useState } from "react";
import { X, Mail, Sparkles, CheckCircle2 } from "lucide-react";
import {
  signInWithKakao,
  signInWithGoogle,
  signInWithMagicLink,
} from "@/lib/subscription/authHelpers";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

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
        text: "로그인 링크가 이메일로 전송되었습니다! 받은편지함을 확인해주세요.",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-100"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6 pt-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">SeedTick 로그인</h3>
          <p className="text-xs text-slate-500 mt-1">
            로그인하고 Pro 멤버십 혜택과 분석 리포트를 관리하세요
          </p>
        </div>

        {message && (
          <div
            className={`p-3 rounded-xl mb-4 text-xs font-medium ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-2"
                : "bg-rose-50 text-rose-600 border border-rose-100"
            }`}
          >
            {message.type === "success" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* 카카오 로그인 버튼 (토스 / 한국 서비스 표준) */}
          <button
            type="button"
            onClick={handleKakaoLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-bold text-sm shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.477 2 10.765c0 2.766 1.848 5.19 4.63 6.558l-1.18 4.364c-.104.385.334.69.64.486l5.176-3.428c.243.023.488.035.734.035 5.523 0 10-3.477 10-7.765S17.523 3 12 3z" />
            </svg>
            <span>카카오로 시작하기</span>
          </button>

          {/* 구글 로그인 버튼 */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-sm shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
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
            <span>Google로 시작하기</span>
          </button>
        </div>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-slate-400">또는 이메일로 링크 받기</span>
          </div>
        </div>

        {/* 이메일 매직링크 폼 */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors disabled:opacity-40"
          >
            이메일 로그인 링크 전송
          </button>
        </form>
      </div>
    </div>
  );
}
