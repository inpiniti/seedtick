import { PlanType, SubscriptionTier } from "./types";

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
export const RESTRICTED_PERIOD_DAYS = 30;

/**
 * 주어진 날짜(YYYY-MM-DD)가 기준일(기본: 현재 시간)로부터 지정된 일수(days) 이내인지 검사합니다.
 */
export function isDateWithinDays(
  dateStr: string,
  days: number = RESTRICTED_PERIOD_DAYS,
  baseDate: Date = new Date()
): boolean {
  if (!dateStr) return false;
  const target = new Date(dateStr + "T00:00:00Z");
  if (isNaN(target.getTime())) return false;

  const base = new Date(baseDate.toISOString().slice(0, 10) + "T00:00:00Z");
  const diffDays = Math.floor((base.getTime() - target.getTime()) / MILLIS_PER_DAY);

  // 미래 날짜이거나 기준일로부터 days일 미만(이내)인 경우 true
  return diffDays < days;
}

/**
 * 사용자 티어(free/pro)에 따라 특정 날짜의 리포트가 열람 제한되는지 판정합니다.
 * - Pro 티어: 제한 없음 (항상 false)
 * - Free 티어: 최근 30일 이내 보고서는 제한됨 (true)
 */
export function isReportRestricted(
  reportDate: string,
  userTier: SubscriptionTier,
  baseDate: Date = new Date()
): boolean {
  if (userTier === "pro") return false;
  return isDateWithinDays(reportDate, RESTRICTED_PERIOD_DAYS, baseDate);
}

/**
 * 사용자 티어에 맞춰 보고서 카탈로그/상세 뷰의 기본 디폴트 선택 날짜를 계산합니다.
 * - Pro 티어: 가장 최신 날짜(목록 첫 번째)
 * - Free 티어: 30일 이전 과거 보고서 중 가장 최신 날짜
 */
export function getDefaultReportDate(
  availableDates: string[],
  userTier: SubscriptionTier,
  baseDate: Date = new Date()
): string {
  if (!availableDates || availableDates.length === 0) return "";

  if (userTier === "pro") {
    return availableDates[0];
  }

  // Free 티어: 30일 이전 날짜 찾기
  const pastDates = availableDates.filter(
    (d) => !isDateWithinDays(d, RESTRICTED_PERIOD_DAYS, baseDate)
  );

  if (pastDates.length > 0) {
    return pastDates[0];
  }

  // 만약 30일 이전 날짜가 전혀 없다면 가장 오래된 날짜 fallback
  return availableDates[availableDates.length - 1];
}

/**
 * 결제 플랜(monthly / yearly)과 기존 만료일을 기반으로 신규 만료일을 계산합니다.
 * - 기존 만료일이 남아있는 경우: 기존 만료일 + 1개월/1년
 * - 기존 만료일이 없거나 지난 경우: 결제 시점(baseDate) + 1개월/1년
 */
export function calculateSubscriptionExpiry(
  currentPeriodEnd: Date | string | null,
  planType: PlanType,
  baseDate: Date = new Date()
): Date {
  let startFrom = new Date(baseDate.getTime());

  if (currentPeriodEnd) {
    const prevEndDate =
      typeof currentPeriodEnd === "string"
        ? new Date(currentPeriodEnd)
        : currentPeriodEnd;

    if (!isNaN(prevEndDate.getTime()) && prevEndDate.getTime() > baseDate.getTime()) {
      startFrom = new Date(prevEndDate.getTime());
    }
  }

  const expiry = new Date(startFrom.getTime());

  if (planType === "monthly") {
    expiry.setMonth(expiry.getMonth() + 1);
  } else if (planType === "yearly") {
    expiry.setFullYear(expiry.getFullYear() + 1);
  }

  return expiry;
}
