"use client";

import React from "react";
import {
  Target,
  Users,
  Compass,
  Terminal,
  Layers,
  BookOpen,
  ArrowLeft,
} from "lucide-react";

export type SidebarSectionId =
  | "all"
  | "sec-reports"
  | "sec-roma"
  | "sec-screener"
  | "sec-audit"
  | "sec-gurus";

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
  romaCount: number;
  logCount: number;
  activeDocTicker?: string | null;
  activeGuruName?: string | null;
  onBackToCatalog?: () => void;
}

export function ResearchSidebar({
  activeSection,
  onSelectSection,
  reportCount,
  candidateCount,
  romaCount,
  logCount,
  activeDocTicker,
  activeGuruName,
  onBackToCatalog,
}: ResearchSidebarProps) {
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
          badge: candidateCount > 0 ? `${candidateCount}` : undefined,
          icon: Compass,
        },
      ],
    },
    {
      group: "Guru Philosophy",
      items: [
        {
          id: "sec-gurus",
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
          id: "sec-audit",
          label: "파이프라인 & 감사 로그",
          badge: logCount > 0 ? `${logCount}` : undefined,
          icon: Terminal,
        },
      ],
    },
  ];

  return (
    <aside
      className="w-[264px] shrink-0 border-r border-[#e2e8f0] bg-white hidden lg:flex flex-col sticky top-[56px] h-[calc(100vh-56px)] self-start overflow-y-auto"
      aria-label="리서치 문서 탐색"
    >
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
                onClick={onBackToCatalog}
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
                    <button
                      onClick={() => onSelectSection(item.id)}
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
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* 13인 거장 코어 목록 */}
        <div className="pt-4 border-t border-[#f1f5f9] space-y-2">
          <div className="flex items-center justify-between px-2.5">
            <span className="font-mono text-[11px] font-medium uppercase text-[#94a3b8]">
              13 Gurus Core
            </span>
            <span className="font-mono text-[10px] text-[#64748b]">v2.4</span>
          </div>
          <div className="flex flex-wrap gap-1 px-1">
            {[
              "워런 버핏",
              "벤저민 그레이엄",
              "피터 린치",
              "찰리 멍거",
              "세스 클라먼",
              "모니시 파브라이",
              "조엘 그린블라트",
              "하워드 막스",
            ].map((guru, idx) => (
              <span
                key={idx}
                className="font-mono text-[10px] px-2 py-0.5 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]"
              >
                {guru}
              </span>
            ))}
          </div>
        </div>
      </div>

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
  );
}
