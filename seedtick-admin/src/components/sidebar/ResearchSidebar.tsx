"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  Target,
  Users,
  Compass,
  Terminal,
  Activity,
  Layers,
  BookOpen,
  ArrowLeft,
  X,
} from "lucide-react";
import { SeedTickLogoBadge } from "@/components/ui/SeedTickLogo";

export type SidebarSectionId =
  | "all"
  | "sec-reports"
  | "sec-roma"
  | "sec-screener"
  | "sec-pipeline"
  | "sec-audit"
  | "sec-gurus";

export const SECTION_HREF_MAP: Record<SidebarSectionId, string> = {
  all: "/",
  "sec-reports": "/stocks",
  "sec-roma": "/screener?tab=roma",
  "sec-screener": "/screener",
  "sec-pipeline": "/pipeline",
  "sec-gurus": "/gurus",
  "sec-audit": "/admin",
};

interface NavItem {
  id: SidebarSectionId;
  prefix?: string;
  label: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

interface ResearchSidebarProps {
  activeSection: SidebarSectionId;
  onSelectSection: (section: SidebarSectionId) => void;
  reportCount: number;
  candidateCount: number;
  krCandidateCount?: number;
  romaCount: number;
  logCount: number;
  activeDocTicker?: string | null;
  activeGuruName?: string | null;
  onBackToCatalog?: () => void;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export function ResearchSidebar({
  activeSection,
  onSelectSection,
  reportCount,
  candidateCount,
  krCandidateCount,
  romaCount,
  logCount,
  activeDocTicker,
  activeGuruName,
  onBackToCatalog,
  isOpenOnMobile = false,
  onCloseMobile,
}: ResearchSidebarProps) {
  // 모바일 드로어가 열렸을 때 ESC 키 누르면 닫기
  useEffect(() => {
    if (!isOpenOnMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpenOnMobile, onCloseMobile]);

  const navItems: NavGroup[] = [
    {
      group: "Overview",
      items: [
        {
          id: "all",
          label: "카탈로그 홈 (전체)",
          badge: reportCount > 0 ? `${reportCount}` : undefined,
          icon: BookOpen,
        },
      ],
    },
    {
      group: "Research Sections",
      items: [
        {
          id: "sec-reports",
          prefix: "01",
          label: "가치평가 및 거장 리포트",
          badge: reportCount > 0 ? `${reportCount}` : undefined,
          icon: Target,
        },
        {
          id: "sec-roma",
          prefix: "02",
          label: "슈퍼인베스터 포트폴리오",
          badge: romaCount > 0 ? `${romaCount}` : undefined,
          icon: Layers,
        },
        {
          id: "sec-screener",
          prefix: "03",
          label: "실시간 발굴 후보군",
          badge:
            candidateCount > 0 || (krCandidateCount && krCandidateCount > 0)
              ? krCandidateCount
                ? `미${candidateCount}·한${krCandidateCount}`
                : `${candidateCount}`
              : undefined,
          icon: Compass,
        },
      ],
    },
    {
      group: "Guru Philosophy",
      items: [
        {
          id: "sec-gurus",
          prefix: "06",
          label: "13인 투자 거장 철학",
          badge: "13",
          icon: Users,
        },
      ],
    },
    {
      group: "System & Operations",
      items: [
        {
          id: "sec-pipeline",
          prefix: "04",
          label: "파이프라인",
          icon: Activity,
        },
        {
          id: "sec-audit",
          prefix: "05",
          label: "감사 로그",
          badge: logCount > 0 ? `${logCount}` : undefined,
          icon: Terminal,
        },
      ],
    },
  ];

  const handleItemClick = (id: SidebarSectionId) => {
    onSelectSection(id);
    onCloseMobile?.();
  };

  const handleBackClick = () => {
    onBackToCatalog?.();
    onCloseMobile?.();
  };

  const renderContent = () => (
    <div className="flex-1 py-6 px-4 space-y-6">
      {/* 열람 중인 보고서 또는 거장 철학 문서가 있는 경우 인라인 표시 */}
      {(activeDocTicker || activeGuruName) && (
        <div className="p-3 rounded-md border border-[#cbd5e1] bg-[#f8fafc] text-xs font-mono space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#64748b] text-[10px] tracking-wider uppercase font-semibold">
              ACTIVE READING
            </span>
            <span className="font-bold text-[#0f172a] truncate max-w-[130px]">
              {activeDocTicker ? `$${activeDocTicker}` : activeGuruName}
            </span>
          </div>
          {onBackToCatalog && (
            <button
              onClick={handleBackClick}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white border border-[#cbd5e1] hover:border-[#0f172a] hover:bg-[#f1f5f9] rounded text-[11px] text-[#0f172a] font-semibold transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>카탈로그로 돌아가기</span>
            </button>
          )}
        </div>
      )}

      {navItems.map((group, gIdx) => (
        <div key={gIdx} className="space-y-1">
          <h3 className="font-mono text-[11px] font-medium tracking-wider uppercase text-[#94a3b8] px-2.5 pb-2">
            {group.group}
          </h3>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = activeSection === item.id;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    href={SECTION_HREF_MAP[item.id] || "/"}
                    onClick={() => handleItemClick(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs rounded-md transition-colors text-left cursor-pointer ${
                      isActive
                        ? "bg-[#0f172a] text-white font-medium shadow-xs"
                        : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.prefix && (
                        <span
                          className={`font-mono text-[10px] shrink-0 ${
                            isActive ? "text-slate-300" : "text-[#94a3b8]"
                          }`}
                        >
                          {item.prefix}
                        </span>
                      )}
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.2 rounded border shrink-0 ${
                          isActive
                            ? "bg-slate-800 text-slate-200 border-slate-700"
                            : "bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

    </div>
  );

  return (
    <>
      {/* ── 1. 데스크톱 사이드바 (lg 이상 고정) ── */}
      <aside
        className="w-[264px] shrink-0 border-r border-[#e2e8f0] bg-white hidden lg:flex flex-col sticky top-[56px] h-[calc(100vh-56px)] self-start overflow-y-auto"
        aria-label="리서치 문서 탐색"
      >
        {renderContent()}

        {/* 하단 시스템 연결 상태 */}
        <div className="p-4 border-t border-[#e2e8f0] bg-[#fafafa]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>AI Gateway Connected</span>
            </span>
            <span className="text-[#94a3b8]">12:00 BATCH</span>
          </div>
        </div>
      </aside>

      {/* ── 2. 모바일 슬라이드오버 드로어 (lg 미만) ── */}
      {isOpenOnMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="모바일 네비게이션 메뉴"
          className="fixed inset-0 z-50 lg:hidden"
        >
          {/* 반투명 배경 (Backdrop) */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />

          {/* 슬라이드오버 패널 */}
          <aside className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200 overflow-y-auto">
            {/* 드로어 헤더 */}
            <div className="px-4 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#fafafa]">
              <div className="flex items-center gap-2.5">
                <SeedTickLogoBadge size="sm" variant="dark" />
                <span className="font-bold text-sm text-[#0f172a]">SeedTick</span>
              </div>
              <button
                onClick={onCloseMobile}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 네비게이션 콘텐츠 */}
            {renderContent()}

            {/* 하단 시스템 연결 상태 */}
            <div className="p-4 border-t border-[#e2e8f0] bg-[#fafafa]">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>AI Gateway Connected</span>
                </span>
                <span className="text-[#94a3b8]">12:00 BATCH</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
