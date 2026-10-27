import type { SidebarSectionId } from "@/components/sidebar/ResearchSidebar";

/** 상세 진입 출처 → 사이드바 선택/뒤로가기 매핑 (단일 진실 공급원) */
export const SECTION_META: Record<
  SidebarSectionId,
  { href: string; label: string; backLabel: string; labelEn: string; backLabelEn: string }
> = {
  all: {
    href: "/",
    label: "카탈로그 홈 (전체)",
    backLabel: "카탈로그 홈으로 돌아가기",
    labelEn: "Catalog Home (All)",
    backLabelEn: "Back to Catalog Home",
  },
  "sec-reports": {
    href: "/stocks",
    label: "가치평가 및 거장 리포트",
    backLabel: "가치평가 및 거장 리포트로 돌아가기",
    labelEn: "Guru Valuations & Reports",
    backLabelEn: "Back to Guru Valuations",
  },
  "sec-roma": {
    href: "/screener?tab=roma",
    label: "슈퍼인베스터 포트폴리오",
    backLabel: "슈퍼인베스터 포트폴리오로 돌아가기",
    labelEn: "Superinvestor Portfolio",
    backLabelEn: "Back to Superinvestor Portfolio",
  },
  "sec-screener": {
    href: "/screener",
    label: "실시간 발굴 후보군",
    backLabel: "실시간 발굴 후보군으로 돌아가기",
    labelEn: "Real-time Discovery Candidates",
    backLabelEn: "Back to Discovery Candidates",
  },
  "sec-outcomes": {
    href: "/outcomes",
    label: "성과 및 거장 적중률",
    backLabel: "성과 및 거장 적중률로 돌아가기",
    labelEn: "Track Record & Accuracy",
    backLabelEn: "Back to Track Record",
  },
  "sec-stats": {
    href: "/stats",
    label: "거장 표결 통계 랭킹",
    backLabel: "거장 표결 통계 랭킹으로 돌아가기",
    labelEn: "Guru Vote Statistics",
    backLabelEn: "Back to Guru Statistics",
  },
  "sec-briefings": {
    href: "/briefings",
    label: "데일리 마켓 브리핑",
    backLabel: "데일리 마켓 브리핑으로 돌아가기",
    labelEn: "Daily Market Briefing",
    backLabelEn: "Back to Market Briefings",
  },
  "sec-gurus": {
    href: "/gurus",
    label: "13인 투자 거장 철학",
    backLabel: "13인 투자 거장 철학으로 돌아가기",
    labelEn: "13 Guru Philosophies",
    backLabelEn: "Back to Guru Philosophies",
  },
  "sec-pipeline": {
    href: "/pipeline",
    label: "파이프라인",
    backLabel: "파이프라인으로 돌아가기",
    labelEn: "Pipeline",
    backLabelEn: "Back to Pipeline",
  },
  "sec-audit": {
    href: "/admin",
    label: "관리자 (트윗·로그)",
    backLabel: "관리자 화면으로 돌아가기",
    labelEn: "Admin (Tweet & Logs)",
    backLabelEn: "Back to Admin",
  },
  "sec-feedback": {
    href: "/feedback",
    label: "의견 및 기능 제안",
    backLabel: "의견 및 기능 제안으로 돌아가기",
    labelEn: "Feedback & Ideas",
    backLabelEn: "Back to Feedback",
  },
};

const VALID_SECTIONS = new Set<string>(Object.keys(SECTION_META));

export function parseSectionId(value: string | null | undefined): SidebarSectionId | null {
  if (!value) return null;
  return VALID_SECTIONS.has(value) ? (value as SidebarSectionId) : null;
}

export function getSectionLabel(id: SidebarSectionId, isEn = false): string {
  const meta = SECTION_META[id] || SECTION_META.all;
  return isEn ? meta.labelEn : meta.label;
}

export function getSectionBackLabel(id: SidebarSectionId, isEn = false): string {
  const meta = SECTION_META[id] || SECTION_META.all;
  return isEn ? meta.backLabelEn : meta.backLabel;
}

export function getSectionHref(id: SidebarSectionId, isEn = false): string {
  const meta = SECTION_META[id] || SECTION_META.all;
  if (!isEn) return meta.href;
  if (meta.href === "/") return "/en";
  return `/en${meta.href}`;
}

/** pathname + ?tab=roma 조합에서 섹션 역추적 (새로고침/직접진입 폴백용, /en 경로 지원) */
export function inferSectionFromLocation(
  pathname: string | null | undefined,
  tabParam: string | null | undefined
): SidebarSectionId | null {
  if (!pathname) return null;
  // /en 접두사 정규화
  const p = pathname.replace(/^\/en(\/|$)/, "$1") || "/";
  if (p === "/") return "all";
  if (p === "/stocks") return "sec-reports";
  if (p.startsWith("/stocks/")) return null; // 상세는 출처(from)가 우선
  if (p === "/screener") return tabParam === "roma" ? "sec-roma" : "sec-screener";
  if (p === "/outcomes") return "sec-outcomes";
  if (p === "/stats") return "sec-stats";
  if (p === "/gurus" || p.startsWith("/gurus/")) return "sec-gurus";
  if (p === "/feedback") return "sec-feedback";
  if (p === "/pipeline") return "sec-pipeline";
  if (p === "/admin") return "sec-audit";
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
