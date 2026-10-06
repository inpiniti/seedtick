"use client";

import React from "react";
import { HealthStatus, AiModelStatus } from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Globe,
  RefreshCw,
  Calendar,
} from "lucide-react";

import { AiModelWidget } from "@/components/header/AiModelWidget";

interface LiveStatusBarProps {
  health: HealthStatus | null;
  aiModel: AiModelStatus | null;
  isResettingModel: boolean;
  onResetModel: () => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export function LiveStatusBar({
  health,
  aiModel,
  isResettingModel,
  onResetModel,
  isLoading,
  onRefresh,
}: LiveStatusBarProps) {
  const isServerHealthy = health?.status === "healthy";
  const isMarketOpen = health?.us_market_today?.is_open ?? false;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#f2f4f6] px-3.5 sm:px-8 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* 서비스 타이틀 & 상태 */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#3182f6] flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
              S
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-[#191f28] tracking-tight truncate">
                  SeedTick 관제센터
                </h1>
                <Badge variant={isServerHealthy ? "success" : "danger"} className="shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {isServerHealthy ? "정상 기동" : "오프라인"}
                </Badge>
              </div>
              <p className="text-[10px] sm:text-xs text-[#8b95a1] leading-none mt-0.5 truncate">
                미국 주식 13인 거장 AI 스크리닝 & 심층 가치평가 리포트
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

        {/* 핵심 메트릭 지표 배너 */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* 1. 오늘 마켓 개장 여부 위젯 */}
          <div className="flex items-center gap-1.5 bg-[#f9fafb] border border-[#e5e8eb] px-3 py-1.5 rounded-2xl min-w-0">
            <Calendar className="w-3.5 h-3.5 text-[#ff9500] shrink-0" />
            <span className="text-[#8b95a1] text-[11px] sm:text-xs font-medium shrink-0">미장:</span>
            <span
              className={`font-bold text-[11px] sm:text-xs ${
                isMarketOpen ? "text-[#03b26c]" : "text-[#f04452]"
              }`}
            >
              {isMarketOpen ? "오늘 개장" : "오늘 휴장"}
            </span>
          </div>

          {/* 2. 일일 파이프라인 정기 스케줄 안내 */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#f9fafb] border border-[#e5e8eb] px-3 py-1.5 rounded-2xl min-w-0">
            <Globe className="w-3.5 h-3.5 text-[#3182f6] shrink-0" />
            <span className="text-[#8b95a1] text-[11px] sm:text-xs font-medium shrink-0">배치:</span>
            <span className="font-semibold text-[#191f28] text-[11px] sm:text-xs">
              매일 12:00 KST
            </span>
          </div>

          {/* 3. 현재 활성 AI 모델 위젯 */}
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
