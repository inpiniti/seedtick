"use client";

import React from "react";
import { HealthStatus, AiModelStatus } from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  RefreshCw,
  Sparkles,
  Activity,
  Layers,
} from "lucide-react";
import { AiModelWidget } from "@/components/header/AiModelWidget";

interface LiveStatusBarProps {
  health: HealthStatus | null;
  aiModel: AiModelStatus | null;
  isResettingModel: boolean;
  onResetModel: () => void;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenPipelineModal?: () => void;
  isPipelineRunning?: boolean;
}

export function LiveStatusBar({
  health,
  aiModel,
  isResettingModel,
  onResetModel,
  isLoading,
  onRefresh,
  onOpenPipelineModal,
  isPipelineRunning = false,
}: LiveStatusBarProps) {
  const isServerHealthy = health?.status === "healthy";
  const isMarketOpen = health?.us_market_today?.is_open ?? false;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] px-4 lg:px-8 h-[56px] flex items-center justify-between">
      {/* 1. 좌측 브랜드 & 타이틀 */}
      <div className="flex items-center gap-3 min-w-0">
        <a href="#" className="flex items-center gap-2 group focus:outline-hidden">
          <span className="font-mono text-xs font-bold bg-[#0f172a] text-white px-2 py-0.5 rounded tracking-wider">
            ST
          </span>
          <span className="font-bold text-sm sm:text-base text-[#0f172a] tracking-tight group-hover:text-blue-600 transition-colors">
            SeedTick
          </span>
          <span className="font-mono text-[11px] text-[#64748b] hidden md:inline border-l border-[#e2e8f0] pl-2.5">
            / RESEARCH & INSIGHTS
          </span>
        </a>

        {/* 서버 상태 뱃지 (미니) */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-[#64748b]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isServerHealthy ? "bg-emerald-500 live-dot" : "bg-rose-500"
            }`}
          />
          <span className="text-[10px] uppercase">
            {isServerHealthy ? "SYSTEM OK" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* 2. 우측 메타데이터 & 액션 버튼들 */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 미장 개장 여부 */}
        <div className="hidden sm:inline-flex items-center gap-1.5 border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 rounded-md text-xs font-mono">
          <span className="text-[#64748b]">US MKT:</span>
          <span
            className={`font-semibold ${
              isMarketOpen ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            {isMarketOpen ? "OPEN" : "CLOSED"}
          </span>
        </div>

        {/* AI 모델 위젯 */}
        <div className="hidden md:block">
          <AiModelWidget
            aiModel={aiModel}
            isResetting={isResettingModel}
            onReset={onResetModel}
          />
        </div>

        {/* 12:00 일일 파이프라인 트리거 버튼 */}
        {onOpenPipelineModal && (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenPipelineModal}
            disabled={isPipelineRunning}
            leftIcon={
              isPipelineRunning ? (
                <Activity className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )
            }
            className="font-mono text-xs font-medium"
          >
            <span className="hidden sm:inline">
              {isPipelineRunning ? "분석 파이프라인 가동 중" : "12:00 파이프라인 실행"}
            </span>
            <span className="sm:hidden">
              {isPipelineRunning ? "가동 중" : "파이프라인"}
            </span>
          </Button>
        )}

        {/* 새로고침 버튼 */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          isLoading={isLoading}
          aria-label="데이터 새로고침"
          className="h-[32px] px-2.5"
        >
          {!isLoading ? <RefreshCw className="w-3.5 h-3.5 text-[#475569]" /> : null}
        </Button>
      </div>
    </header>
  );
}
