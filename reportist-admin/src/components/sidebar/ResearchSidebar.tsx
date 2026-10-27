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
  Award,
  MessageSquarePlus,
  BarChart3,
  Newspaper,
} from "lucide-react";
import { ReportistLogoBadge } from "@/components/ui/ReportistLogo";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { IS_OPEN_BETA } from "@/lib/subscription/subscriptionPolicy";
import { useLanguage } from "@/contexts/LanguageContext";
import { getSectionLabel, getSectionBackLabel, getSectionHref } from "@/lib/sectionNav";

export type SidebarSectionId =
  | "all"
  | "sec-reports"
  | "sec-roma"
  | "sec-screener"
  | "sec-outcomes"
  | "sec-stats"
  | "sec-briefings"
  | "sec-pipeline"
  | "sec-audit"
  | "sec-gurus"
  | "sec-feedback";

export const SECTION_HREF_MAP: Record<SidebarSectionId, string> = {
  all: "/",
  "sec-reports": "/stocks",
  "sec-roma": "/screener?tab=roma",
  "sec-screener": "/screener",
  "sec-outcomes": "/outcomes",
  "sec-stats": "/stats",
  "sec-briefings": "/briefings",
  "sec-pipeline": "/pipeline",
  "sec-gurus": "/gurus",
  "sec-audit": "/admin",
  "sec-feedback": "/feedback",
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
  /** 상세 화면 뒤로가기 문구 (출처 섹션별 동적 표시, 기본값: 카탈로그로 돌아가기) */
  backLabel?: string;
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
  backLabel,
  isOpenOnMobile = false,
  onCloseMobile,
}: ResearchSidebarProps) {
  const { tier, isTrialActive, trialRemainingHours, isAdmin } = useSubscription();
  const { isEn } = useLanguage();
  const isPro = tier === "pro";

  // 모바일 드로어가 열렸을 때 ESC 키 누르면 닫기
  useEffect(() => {
    if (!isOpenOnMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpenOnMobile, onCloseMobile]);

  // 파이프라인 + 감사 로그는 찐 어드민 전용 (관리자 로그인 시에만 노출)
  const adminItems: NavItem[] = isAdmin
    ? [
        {
          id: "sec-pipeline" as SidebarSectionId,
          prefix: "07",
          label: getSectionLabel("sec-pipeline", isEn),
          icon: Activity,
        },
        {
          id: "sec-audit" as SidebarSectionId,
          prefix: "08",
          label: getSectionLabel("sec-audit", isEn),
          badge: logCount > 0 ? `${logCount}` : undefined,
          icon: Terminal,
        },
      ]
    : [];

  const allGroups: NavGroup[] = [
    {
      group: "Overview",
      items: [
        {
          id: "all",
          label: getSectionLabel("all", isEn),
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
          label: getSectionLabel("sec-reports", isEn),
          badge: reportCount > 0 ? `${reportCount}` : undefined,
          icon: Target,
        },
        {
          id: "sec-roma",
          prefix: "02",
          label: getSectionLabel("sec-roma", isEn),
          badge: romaCount > 0 ? `${romaCount}` : undefined,
          icon: Layers,
        },
        {
          id: "sec-screener",
          prefix: "03",
          label: getSectionLabel("sec-screener", isEn),
          badge:
            candidateCount > 0 || (krCandidateCount && krCandidateCount > 0)
              ? krCandidateCount
                ? isEn
                  ? `US ${candidateCount} · KR ${krCandidateCount}`
                  : `미${candidateCount}·한${krCandidateCount}`
                : `${candidateCount}`
              : undefined,
          icon: Compass,
        },
        {
          id: "sec-outcomes",
          prefix: "04",
          label: getSectionLabel("sec-outcomes", isEn),
          icon: Award,
        },
        {
          id: "sec-stats",
          prefix: "05",
          label: getSectionLabel("sec-stats", isEn),
          icon: BarChart3,
        },
        {
          id: "sec-briefings",
          prefix: "06",
          label: getSectionLabel("sec-briefings", isEn),
          icon: Newspaper,
        },
      ],
    },
    {
      group: "Guru Philosophy",
      items: [
        {
          id: "sec-gurus",
          prefix: "07",
          label: getSectionLabel("sec-gurus", isEn),
          badge: "13",
          icon: Users,
        },
      ],
    },
    {
      group: "Community",
      items: [
        {
          id: "sec-feedback",
          prefix: "08",
          label: getSectionLabel("sec-feedback", isEn),
          icon: MessageSquarePlus,
        },
      ],
    },
    {
      group: "System & Operations",
      items: adminItems,
    },
  ];

  const navItems = allGroups.filter((g) => g.items.length > 0);

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
              <span>{backLabel || (isEn ? "Back to Catalog Home" : "카탈로그로 돌아가기")}</span>
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
                    href={getSectionHref(item.id, isEn)}
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

      {/* Pro / Trial 멤버십 카드 배너 (오픈 베타 모드 우선 분기) */}
      <div className="pt-3 border-t border-[#e2e8f0]">
        {IS_OPEN_BETA ? (
          <div className="p-3 rounded-md bg-blue-50/60 border border-blue-200/80 font-mono text-xs">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="font-semibold text-blue-900 text-[11px] uppercase tracking-wider">
                OPEN BETA ACCESS
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-600 text-white">
                FREE PASS
              </span>
            </div>
            <p className="text-[11px] text-blue-800/80 leading-tight mb-2.5">
              {isEn
                ? "All 13-guru AI reports and fair values are free to explore during open beta."
                : "13인 투자 거장 최신 AI 리포트와 적정주가를 누구나 무료로 열람하실 수 있습니다."}
            </p>
            <Link
              href={isEn ? "/en/gurus" : "/gurus"}
              className="block w-full py-1.5 px-2 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white text-center text-[11px] font-medium shadow-2xs transition-colors"
            >
              {isEn ? "Explore 13 Guru Philosophies" : "13인 거장 철학 가이드 보기"}
            </Link>
          </div>
        ) : (
          <div className="p-3 rounded-md bg-[#f8fafc] border border-[#e2e8f0] font-mono text-xs">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="font-semibold text-[#0f172a] text-[11px] uppercase tracking-wider">
                {isPro ? "REPORTIST PRO" : isTrialActive ? "24H TRIAL" : "UPGRADE TO PRO"}
              </span>
              <span className="text-[10px] px-1 py-0.2 rounded border border-[#cbd5e1] bg-white text-[#0f172a]">
                {isPro ? "ACTIVE" : isTrialActive ? `${trialRemainingHours}H LEFT` : "2,900원"}
              </span>
            </div>
            <p className="text-[11px] text-[#64748b] leading-tight mb-2.5">
              {isPro
                ? isEn
                  ? "Full access to all 13-guru AI reports"
                  : "13인 거장 최신 AI 리포트 전체 열람 중"
                : isTrialActive
                ? isEn
                  ? "First visit 24-hour full access trial active"
                  : "첫 방문 24시간 전체 리포트 무료 체험 중"
                : isEn
                ? "Recent 1-month reports & real-time valuations"
                : "최근 1개월 보고서 및 실시간 가치평가 열람"}
            </p>
            <Link
              href={isPro || isTrialActive ? (isEn ? "/en/account" : "/account") : (isEn ? "/en/pricing" : "/pricing")}
              className="block w-full py-1.5 px-2 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white text-center text-[11px] font-medium shadow-2xs transition-colors"
            >
              {isPro
                ? isEn
                  ? "Manage Membership"
                  : "멤버십 관리"
                : isTrialActive
                ? isEn
                  ? "Trial Benefits & Settings"
                  : "체험 혜택 및 멤버십 관리"
                : isEn
                ? "Start Pro ($2.99 / mo)"
                : "Pro 시작하기 (월 2,900원)"}
            </Link>
          </div>
        )}
      </div>
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
                <ReportistLogoBadge size="sm" variant="dark" />
                <span className="font-bold text-sm text-[#0f172a]">Reportist</span>
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
          </aside>
        </div>
      )}
    </>
  );
}
