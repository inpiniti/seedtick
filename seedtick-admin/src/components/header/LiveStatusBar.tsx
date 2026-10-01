"use client";

import React, { useState } from "react";
import { HealthStatus, IpStatus, AiModelStatus } from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Check,
  Copy,
  Globe,
  RefreshCw,
  Calendar,
  ShieldAlert,
} from "lucide-react";

import { AiModelWidget } from "@/components/header/AiModelWidget";

interface LiveStatusBarProps {
  health: HealthStatus | null;
  ipInfo: IpStatus | null;
  aiModel: AiModelStatus | null;
  isResettingModel: boolean;
  onResetModel: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export function LiveStatusBar({
  health,
  ipInfo,
  aiModel,
  isResettingModel,
  onResetModel,
  isLoading,
  onRefresh,
}: LiveStatusBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyIp = async () => {
    if (!ipInfo?.server_public_ip) return;
    try {
      await navigator.clipboard.writeText(ipInfo.server_public_ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const isServerHealthy = health?.status === "healthy";
  const isMarketOpen = health?.us_market_today?.is_open ?? false;
  const isDryRun = health?.dry_run ?? true;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#f2f4f6] px-3.5 sm:px-8 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* 서비스 타이틀 & 상태 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3182f6] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-[#191f28] tracking-tight">
                  SeedTick 관제센터
                </h1>
                <Badge variant={isServerHealthy ? "success" : "danger"}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {isServerHealthy ? "정상 기동" : "오프라인"}
                </Badge>
              </div>
              <p className="text-[10px] sm:text-xs text-[#8b95a1] leading-none mt-0.5">
                미국 주식 13인 거장 AI 스크리닝 & 자동매매
              </p>
            </div>
          </div>

          {/* 모바일 화면용 새로고침 버튼 (우측 상단) */}
          <div className="lg:hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              isLoading={isLoading}
              className="h-[34px] w-[34px] p-0 rounded-xl"
              aria-label="새로고침"
            >
              {!isLoading ? <RefreshCw className="w-3.5 h-3.5 text-[#4e5968]" /> : null}
            </Button>
          </div>
        </div>

        {/* 핵심 메트릭 지표 배너 (모바일: 2열 그리드, 데스크톱: 인라인 flex) */}
        <div className="grid grid-cols-2 sm:flex sm:items-center sm:flex-wrap gap-2 text-xs">
          {/* 1. 서버 공인 IP 위젯 (터치 시 원터치 복사) */}
          <div
            onClick={handleCopyIp}
            className="flex items-center justify-between sm:justify-start gap-1.5 bg-[#f9fafb] border border-[#e5e8eb] px-3 py-2 sm:py-1.5 rounded-2xl hover:bg-[#f2f4f6] transition-colors cursor-pointer select-none"
            title="토스/한투 WTS 허용 IP 등록을 위해 복사"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-3.5 h-3.5 text-[#3182f6] shrink-0" />
              <span className="font-semibold text-[#191f28] font-mono text-[11px] sm:text-xs truncate">
                {ipInfo?.server_public_ip || "IP 확인 중..."}
              </span>
            </div>
            <div className="shrink-0 text-[#8b95a1]">
              {copied ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#03b26c]">
                  <Check className="w-3 h-3" /> 복사됨
                </span>
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </div>
          </div>

          {/* 2. 오늘 마켓 개장 여부 위젯 */}
          <div className="flex items-center gap-1.5 bg-[#f9fafb] border border-[#e5e8eb] px-3 py-2 sm:py-1.5 rounded-2xl">
            <Calendar className="w-3.5 h-3.5 text-[#ff9500] shrink-0" />
            <span className="text-[#8b95a1] text-[11px] sm:text-xs font-medium">미장:</span>
            <span
              className={`font-bold text-[11px] sm:text-xs ${
                isMarketOpen ? "text-[#03b26c]" : "text-[#f04452]"
              }`}
            >
              {isMarketOpen ? "오늘 개장" : "오늘 휴장"}
            </span>
          </div>

          {/* 3. 자동주문 실행 모드 배지 */}
          <div className="flex items-center gap-1.5 bg-[#f9fafb] border border-[#e5e8eb] px-3 py-2 sm:py-1.5 rounded-2xl col-span-2 sm:col-span-1">
            <ShieldAlert className="w-3.5 h-3.5 text-[#6b7684] shrink-0" />
            <span className="text-[#8b95a1] text-[11px] sm:text-xs font-medium">모드:</span>
            {isDryRun ? (
              <span className="font-bold text-[#3182f6] text-[11px] sm:text-xs">
                DRY-RUN (모의투자)
              </span>
            ) : (
              <span className="font-bold text-[#f04452] text-[11px] sm:text-xs">
                REAL (실거래)
              </span>
            )}
          </div>

          {/* 4. 현재 활성 AI 모델 위젯 */}
          <AiModelWidget
            aiModel={aiModel}
            isResetting={isResettingModel}
            onReset={onResetModel}
          />

          {/* 5. 데스크톱용 새로고침 버튼 */}
          <div className="hidden lg:block">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              isLoading={isLoading}
              className="rounded-2xl h-[34px] px-3"
              leftIcon={
                !isLoading ? <RefreshCw className="w-3.5 h-3.5" /> : undefined
              }
            >
              새로고침
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
