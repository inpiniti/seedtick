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
 * 권한 없는 행의 민감 컬럼 전면 제거.
 * 공개 허용: id / d / ticker / company_name / current_price / created_at
 * 그 외 (적정가·밴드·표결·verdict·요약·데이터팩·본문 등)는 전부 null.
 * → 오버레이를 지워도 보여줄 내용이 없고, Network 탭에도 민감값이 없음.
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
    verdict: "",
    overall_score: 0,
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
    votes_buy: null,
    votes_hold: null,
    votes_watch: null,
    votes_sell: null,
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

/** SSR/SEO용: 로그인 컨텍스트가 없을 때는 무조건 public(free) 기준으로 마스킹 */
export function maskReportRowPublic(row: GuruReportRow): GuruReportRow {
  return maskReportRow(
    row,
    !isReportRestricted(row.d, "free", new Date(), undefined, false)
  );
}
