"use client";

import React from "react";
import { HealthStatus } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { RefreshCw, Menu } from "lucide-react";
import { SeedTickLogoBadge } from "@/components/ui/SeedTickLogo";

interface LiveStatusBarProps {
  health: HealthStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
  onToggleMobileMenu?: () => void;
}

export function LiveStatusBar({
  health,
  isLoading,
  onRefresh,
  onToggleMobileMenu,
}: LiveStatusBarProps) {
  const isServerHealthy = health?.status === "healthy";

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#e2e8f0] px-4 lg:px-8 h-[56px] flex items-center justify-between">
      {/* 1. 좌측 브랜드 & 타이틀 */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* 모바일 햄버거 메뉴 열기 버튼 */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 -ml-1 text-[#0f172a] hover:bg-[#f1f5f9] rounded-md transition-colors cursor-pointer"
          aria-label="사이드바 메뉴 열기"
        >
          <Menu className="w-5 h-5" />
        </button>

        <a href="#" className="flex items-center gap-2.5 group focus:outline-hidden">
          <SeedTickLogoBadge size="sm" variant="dark" />
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

      {/* 2. 우측 액션 버튼들 */}
      <div className="flex items-center gap-2 sm:gap-3">
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
