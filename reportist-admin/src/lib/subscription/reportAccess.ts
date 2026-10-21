import type { User } from "@supabase/supabase-js";
import type { GuruReportRow } from "@/types/api";
import {
  authenticateServerRequest,
  getServerSupabaseClient,
} from "@/lib/subscription/supabaseServer";
import {
  getDefaultReportDate,
  isReportRestricted,
  isWelcomeTrialActive,
} from "@/lib/subscription/subscriptionPolicy";
import type { SubscriptionTier } from "@/lib/subscription/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReportAccess {
  user: User | null;
  tier: SubscriptionTier;
  isTrialActive: boolean;
}

/**
 * 요청의 열람 권한을 서버에서 판정합니다 (유일한 진실).
 * - 토큰 없음/검증 실패 → free, 체험 없음 (fail-closed)
 * - 토큰 있음 → subscriptions 테이블 + 가입시각(24h trial)으로 판정
 */
export async function resolveReportAccess(req: Request): Promise<ReportAccess> {
  const { user } = await authenticateServerRequest(req).catch(() => ({
    user: null as User | null,
  }));
  if (!user) return { user: null, tier: "free", isTrialActive: false };

  let tier: SubscriptionTier = "free";
  try {
    const supabase = getServerSupabaseClient();
    if (supabase) {
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("tier, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      const rawTier = (subRow?.tier as SubscriptionTier | undefined) ?? "free";
      const periodEnd = subRow?.current_period_end as string | null;
      // 만료된 Pro는 free로 강등 (billing/status와 동일 기준)
      if (
        rawTier === "pro" &&
        periodEnd &&
        new Date(periodEnd).getTime() < Date.now()
      ) {
        tier = "free";
      } else {
        tier = rawTier;
      }
    }
  } catch {
    // 조회 실패 시 등급을 올려주지 않음 (fail-closed)
    tier = "free";
  }

  const isTrialActive =
    tier === "pro"
      ? false
      : isWelcomeTrialActive(
          (user as User).created_at ?? null,
          new Date()
        );

  return { user, tier, isTrialActive };
}

/** 특정 분석일자가 이 접근자에게 허용되는지 (서버 판정) */
export function isDateAllowedForAccess(
  reportDate: string,
  access: Pick<ReportAccess, "tier" | "isTrialActive">,
  baseDate: Date = new Date(),
  allowedFreeDate?: string
): boolean {
  return !isReportRestricted(
    reportDate,
    access.tier,
    baseDate,
    allowedFreeDate,
    access.isTrialActive
  );
}

/**
 * Free 폴백 예외를 서버에서도 동일하게 재현합니다.
 * 30일 이전 날짜가 DB에 하나도 없을 때 클라이언트는 가장 오래된 날짜를
 * 무료 디폴트로 허용하므로, 서버도 DB 전체 일자 기준으로 같은 값을 계산해
 * 허용해야 목록/상세가 마스킹 없이 정상 표시됩니다.
 * 클라이언트가 보낸 날짜는 신뢰하지 않고 서버가 직접 조회합니다.
 */
export async function getServerAllowedFreeDate(
  supabase: SupabaseClient,
  baseDate: Date = new Date()
): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("d")
      .order("d", { ascending: false })
      .limit(1000);
    if (error) return undefined;
    const dates = Array.from(
      new Set(
        ((data as Array<{ d: string }>) || [])
          .map((r) => r.d)
          .filter(Boolean)
      )
    ).sort().reverse();
    if (dates.length === 0) return undefined;
    return getDefaultReportDate(dates, "free", baseDate, false) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 권한 없는 행의 민감 컬럼 전면 제거 (Teaser Stats 전략).
 * 공개 허용:
 * - 기본 메타: id / d / ticker / company_name / current_price / created_at
 * - 티저 통계 (SEO & AI 검색 인용 / 유입 호기심 유발): verdict / overall_score / votes_* (13인 표결 수치)
 * 비공개 잠금 (Pro 멤버십 전용):
 * - 거장별 상세 코멘트 (summaries), 최종 리포트 본문 (final_report), 데이터팩 (datapack)
 * - 정밀 매매 타점 (fair_value, band_*, safety_entry, target_sell, upside_pct)
 */
export function maskReportRow(
  row: GuruReportRow,
  allowed: boolean
): GuruReportRow {
  if (allowed) return row;
  return {
    id: row.id,
    d: row.d,
    ticker: row.ticker,
    company_name: row.company_name,
    current_price: row.current_price,
    verdict: row.verdict || "",
    overall_score: typeof row.overall_score === "number" ? row.overall_score : 0,
    vote_summary: null,
    datapack: null,
    summaries: null,
    final_report: null,
    fair_value: null,
    band_low: null,
    band_high: null,
    safety_entry: null,
    target_sell: null,
    upside_pct: null,
    votes_buy: row.votes_buy,
    votes_hold: row.votes_hold,
    votes_watch: row.votes_watch,
    votes_sell: row.votes_sell,
    avg_confidence: null,
    dispersion_pct: null,
    price_estimate_count: null,
    conclusion: null,
    hot_topics: null,
    bull_points: null,
    bear_points: null,
    key_drivers: null,
    action_guide: null,
    valuation_flags: null,
    parse_mode: null,
    prompt_version: null,
    created_at: row.created_at,
  };
}

/**
 * SSR/SEO용: 로그인 컨텍스트가 없을 때는 public(free) 기준으로 마스킹.
 *
 * allowedFreeDate는 "DB에 30일 이전 행이 하나도 없을 때 가장 오래된 일자를
 * 무료로 허용"하는 폴백 규칙의 기준일이다. 서버 API(getServerAllowedFreeDate)와
 * 동일하게 전달해야 SSR과 API의 마스킹 결과가 일치한다.
 * (기존에는 undefined를 넘겨서 공개 가능한 날짜까지 제한으로 처리했다)
 */
export function maskReportRowPublic(
  row: GuruReportRow,
  allowedFreeDate?: string
): GuruReportRow {
  return maskReportRow(
    row,
    !isReportRestricted(row.d, "free", new Date(), allowedFreeDate, false)
  );
}
