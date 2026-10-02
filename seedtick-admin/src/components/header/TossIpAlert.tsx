"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ShieldAlert, Copy, Check, RefreshCw } from "lucide-react";

interface TossIpAlertProps {
  /** 서버의 외부 공인 IP (토스 WTS 허용 IP에 등록할 값) */
  serverPublicIp?: string;
  isRetrying: boolean;
  onRetry: () => Promise<{ success: boolean; message: string }>;
}

/**
 * 토스 허용 IP 미등록(403)으로 토스 연결이 멈춘 상태를 안내하는 배너.
 *
 * 서버 IP를 토스 WTS 허용 IP에 등록한 뒤 "다시 연결"을 누르면
 * 서버가 1회 실제 연결을 확인하고, 성공하면 이 배너가 사라진다.
 */
export function TossIpAlert({ serverPublicIp, isRetrying, onRetry }: TossIpAlertProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const handleCopy = async () => {
    if (!serverPublicIp) return;
    try {
      await navigator.clipboard.writeText(serverPublicIp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 무시
    }
  };

  const handleRetry = async () => {
    setFeedback(null);
    const res = await onRetry();
    setFeedback({ type: res.success ? "success" : "error", message: res.message });
    if (res.success) {
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="rounded-3xl border border-[#ffe3b3] bg-[#fff8ee] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-2xl bg-[#fff1dc] flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5 text-[#ff9500]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-[#191f28]">토스 연결이 잠시 멈춰 있어요</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fff1dc] text-[#ff9500] text-[11px] font-semibold">
              연결 대기
            </span>
          </div>

          <p className="mt-1 text-xs text-[#4e5968] leading-relaxed">
            토스 Open API가 서버 IP를 허용 목록에서 찾지 못했어요. 토스 WTS의{" "}
            <strong className="font-semibold">Open API &gt; 허용 IP</strong>에 아래 IP를 등록한 뒤
            다시 연결해 주세요. 등록 전까지는 토스 요청을 보내지 않고 기다려요.
          </p>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!serverPublicIp}
            className="mt-3 inline-flex items-center gap-2 bg-white border border-[#e5e8eb] px-3 py-2 rounded-2xl hover:bg-[#f9fafb] transition-colors cursor-pointer disabled:cursor-default"
            title="토스 WTS 허용 IP에 등록할 서버 공인 IP 복사"
          >
            <span className="font-mono text-xs font-semibold text-[#191f28]">
              {serverPublicIp || "IP 확인 중..."}
            </span>
            {copied ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-[#03b26c]">
                <Check className="w-3 h-3" /> 복사했어요
              </span>
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#8b95a1]" />
            )}
          </button>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRetry}
              isLoading={isRetrying}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto justify-center"
            >
              IP 등록 완료 — 다시 연결하기
            </Button>
            {feedback && (
              <span
                className={`text-xs font-semibold ${
                  feedback.type === "success" ? "text-[#03b26c]" : "text-[#f04452]"
                }`}
              >
                {feedback.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}