import type { SidebarSectionId } from "@/components/sidebar/ResearchSidebar";

/** 상세 진입 출처 → 사이드바 선택/뒤로가기 매핑 (단일 진실 공급원) */
export const SECTION_META: Record<
  SidebarSectionId,
  { href: string; label: string; backLabel: string }
> = {
  all: {
    href: "/",
    label: "카탈로그 홈 (전체)",
    backLabel: "카탈로그 홈으로 돌아가기",
  },
  "sec-reports": {
    href: "/stocks",
    label: "가치평가 및 거장 리포트",
    backLabel: "가치평가 및 거장 리포트로 돌아가기",
  },
  "sec-roma": {
    href: "/screener?tab=roma",
    label: "슈퍼인베스터 포트폴리오",
    backLabel: "슈퍼인베스터 포트폴리오로 돌아가기",
  },
  "sec-screener": {
    href: "/screener",
    label: "실시간 발굴 후보군",
    backLabel: "실시간 발굴 후보군으로 돌아가기",
  },
  "sec-outcomes": {
    href: "/outcomes",
    label: "성과 및 거장 적중률",
    backLabel: "성과 및 거장 적중률로 돌아가기",
  },
  "sec-gurus": {
    href: "/gurus",
    label: "13인 투자 거장 철학",
    backLabel: "13인 투자 거장 철학으로 돌아가기",
  },
  "sec-pipeline": {
    href: "/pipeline",
    label: "파이프라인",
    backLabel: "파이프라인으로 돌아가기",
  },
  "sec-audit": {
    href: "/admin",
    label: "감사 로그",
    backLabel: "감사 로그로 돌아가기",
  },
};

const VALID_SECTIONS = new Set<string>(Object.keys(SECTION_META));

export function parseSectionId(value: string | null | undefined): SidebarSectionId | null {
  if (!value) return null;
  return VALID_SECTIONS.has(value) ? (value as SidebarSectionId) : null;
}

/** pathname + ?tab=roma 조합에서 섹션 역추적 (새로고침/직접진입 폴백용) */
export function inferSectionFromLocation(
  pathname: string | null | undefined,
  tabParam: string | null | undefined
): SidebarSectionId | null {
  if (!pathname) return null;
  if (pathname === "/") return "all";
  if (pathname === "/stocks") return "sec-reports";
  if (pathname.startsWith("/stocks/")) return null; // 상세는 출처(from)가 우선
  if (pathname === "/screener") return tabParam === "roma" ? "sec-roma" : "sec-screener";
  if (pathname === "/outcomes") return "sec-outcomes";
  if (pathname === "/gurus" || pathname.startsWith("/gurus/")) return "sec-gurus";
  if (pathname === "/pipeline") return "sec-pipeline";
  if (pathname === "/admin") return "sec-audit";
  return null;
}

const LAST_SECTION_KEY = "reportist_last_section_v1";

/** 마지막으로 본 목록 섹션 (상세 직접진입 시 사이드바 선택 유지용, 새로고침에도 유지) */
export function loadLastSectionId(): SidebarSectionId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LAST_SECTION_KEY);
    return parseSectionId(raw);
  } catch {
    return null;
  }
}

export function saveLastSectionId(section: SidebarSectionId): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LAST_SECTION_KEY, section);
  } catch {
    // 무시
  }
}
