import { PlanType, SubscriptionTier } from "./types";

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
export const RESTRICTED_PERIOD_DAYS = 30;
export const WELCOME_TRIAL_HOURS = 24;
export const WELCOME_TRIAL_MILLIS = WELCOME_TRIAL_HOURS * 60 * 60 * 1000;

/**
 * 오픈 베타 모드 플래그
 * - true: 로그인/결제 없이 모든 사용자에게 최신 리포트 및 전체 데이터 100% 무료 개방
 * - false: 기존 24시간 무료 체험 및 Pro 구독 페이월 시스템으로 즉시 복원
 */
export const IS_OPEN_BETA = true;

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
 * 신규 회원가입 시점(userCreatedAt)을 기준으로 24시간 무료 체험 기간이 유효한지 판정합니다.
 */
export function isWelcomeTrialActive(
  userCreatedAt?: string | Date | null,
  baseDate: Date = new Date()
): boolean {
  if (!userCreatedAt) return false;
  const createdDate =
    typeof userCreatedAt === "string" ? new Date(userCreatedAt) : userCreatedAt;
  if (isNaN(createdDate.getTime())) return false;

  const diffMillis = baseDate.getTime() - createdDate.getTime();
  // 가입 직후부터 24시간(86,400,000ms) 미만인 경우 true (서버-클라이언트 간 시계 미세 오차 -5분 허용)
  return diffMillis >= -5 * 60 * 1000 && diffMillis < WELCOME_TRIAL_MILLIS;
}

/**
 * 24시간 무료 체험의 잔여 시간(시 단위 올림)을 반환합니다. 만료되었거나 비활성 시 0 반환.
 */
export function getRemainingTrialHours(
  userCreatedAt?: string | Date | null,
  baseDate: Date = new Date()
): number {
  if (!userCreatedAt) return 0;
  const createdDate =
    typeof userCreatedAt === "string" ? new Date(userCreatedAt) : userCreatedAt;
  if (isNaN(createdDate.getTime())) return 0;

  const diffMillis = baseDate.getTime() - createdDate.getTime();
  const remainingMillis = WELCOME_TRIAL_MILLIS - diffMillis;
  if (remainingMillis <= 0 || diffMillis >= WELCOME_TRIAL_MILLIS) return 0;

  return Math.min(
    WELCOME_TRIAL_HOURS,
    Math.max(1, Math.ceil(remainingMillis / (60 * 60 * 1000)))
  );
}

/**
 * 사용자 티어(free/pro) 및 24시간 체험 활성 여부에 따라 특정 날짜의 리포트가 열람 제한되는지 판정합니다.
 * - Pro 티어 또는 24시간 무료 체험(isTrialActive = true): 제한 없음 (항상 false)
 * - Free 티어 (체험 만료/미적용): 최근 30일 이내 보고서는 제한됨 (true).
 *   단, 30일 이전 날짜가 DB에 없어서 fallback된 Free 디폴트 기준일(allowedFreeDate)은 열람을 허용합니다.
 */
export function isReportRestricted(
  reportDate: string,
  userTier: SubscriptionTier,
  baseDate: Date = new Date(),
  allowedFreeDate?: string,
  isTrialActive: boolean = false,
  isOpenBeta: boolean = IS_OPEN_BETA
): boolean {
  // 오픈 베타 모드: 모든 사용자에게 열람 제한 전면 해제
  if (isOpenBeta) return false;
  if (userTier === "pro" || isTrialActive) return false;
  if (allowedFreeDate && reportDate === allowedFreeDate) return false;
  return isDateWithinDays(reportDate, RESTRICTED_PERIOD_DAYS, baseDate);
}

/**
 * 사용자 티어 및 체험 활성 여부에 맞춰 보고서 카탈로그/상세 뷰의 기본 디폴트 선택 날짜를 계산합니다.
 * - Pro 티어 또는 24시간 무료 체험 중: 가장 최신 날짜(목록 첫 번째)
 * - Free 티어 (체험 만료): 30일 이전 과거 보고서 중 가장 최신 날짜
 */
export function getDefaultReportDate(
  availableDates: string[],
  userTier: SubscriptionTier,
  baseDate: Date = new Date(),
  isTrialActive: boolean = false,
  isOpenBeta: boolean = IS_OPEN_BETA
): string {
  if (!availableDates || availableDates.length === 0) return "";

  // 오픈 베타 모드이거나 Pro/체험 중인 경우 가장 최신 날짜가 디폴트
  if (isOpenBeta || userTier === "pro" || isTrialActive) {
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

/** 결제 후 전액 환불 가능한 청약철회 기간(일) */
export const REFUND_WINDOW_DAYS = 7;

/**
 * 서버/클라이언트 공통 가격표 (단일 진실 공급원).
 * 실제 청구는 서버가 이 값으로 검증하므로 클라이언트 금액은 절대 신뢰하지 않습니다.
 */
export const PLAN_AMOUNTS: Record<"monthly" | "yearly", number> = {
  monthly: 2900,
  yearly: 29000,
};

export function getPlanAmount(planType: PlanType): number {
  if (planType === "monthly") return PLAN_AMOUNTS.monthly;
  if (planType === "yearly") return PLAN_AMOUNTS.yearly;
  throw new Error("유효하지 않은 플랜입니다.");
}

/**
 * 만료일까지 남은 일수(올림). 만료되었거나 값이 없으면 0.
 */
export function getRemainingDays(
  periodEnd: string | Date | null | undefined,
  now: Date = new Date()
): number {
  if (!periodEnd) return 0;
  const end = typeof periodEnd === "string" ? new Date(periodEnd) : periodEnd;
  if (isNaN(end.getTime())) return 0;
  const diff = end.getTime() - now.getTime();
  return diff > 0 ? Math.ceil(diff / MILLIS_PER_DAY) : 0;
}

export interface ProratedRefundResult {
  mode: "refund" | "end_of_period";
  refundAmount: number;
  usedAmount: number;
  usedDays: number;
  totalDays: number;
  reason: string;
}

export type CancellationDecision = ProratedRefundResult;

/**
 * 일할 계산 부분 환불 금액 산출
 * - 7일 이내 해지 시: 사용 일수(최소 1일)에 해당하는 이용료를 공제한 잔여 금액 환불
 * - 7일 초과 시: 환불 불가(0원), current_period_end까지 이용 유지
 */
export function calculateProratedRefund(input: {
  amount: number;
  planType: PlanType;
  paidAt: string | Date | null | undefined;
  now?: Date;
  alreadyRefunded?: boolean;
}): ProratedRefundResult {
  const { amount, planType, paidAt, now = new Date(), alreadyRefunded = false } = input;
  const totalDays = planType === "yearly" ? 365 : 30;

  if (!paidAt || alreadyRefunded || amount <= 0) {
    return {
      mode: "end_of_period",
      refundAmount: 0,
      usedAmount: 0,
      usedDays: 0,
      totalDays,
      reason: alreadyRefunded ? "이미 환불 완료된 건입니다." : "유효한 결제 내역이 없습니다.",
    };
  }

  const paid = typeof paidAt === "string" ? new Date(paidAt) : paidAt;
  if (isNaN(paid.getTime())) {
    return {
      mode: "end_of_period",
      refundAmount: 0,
      usedAmount: 0,
      usedDays: 0,
      totalDays,
      reason: "결제 일시가 유효하지 않습니다.",
    };
  }

  const elapsedMillis = now.getTime() - paid.getTime();
  if (elapsedMillis >= REFUND_WINDOW_DAYS * MILLIS_PER_DAY) {
    return {
      mode: "end_of_period",
      refundAmount: 0,
      usedAmount: 0,
      usedDays: 0,
      totalDays,
      reason: "청약철회 기간(7일) 초과로 인한 자동갱신 해지",
    };
  }

  // 7일 이내 해지: 최소 1일분 사용 공제 (하루라도 서비스를 썼다면 1일분 제함)
  const usedDays = Math.max(1, Math.ceil(Math.max(0, elapsedMillis) / MILLIS_PER_DAY));
  const dailyRate = amount / totalDays;
  const usedAmount = Math.min(amount, Math.ceil(usedDays * dailyRate));
  const refundAmount = Math.max(0, amount - usedAmount);

  return {
    mode: "refund",
    refundAmount,
    usedAmount,
    usedDays,
    totalDays,
    reason: `${usedDays}일 이용 요금(${usedAmount.toLocaleString()}원)을 공제한 잔여 금액 부분 환불`,
  };
}

/**
 * 구독 해지 방식 결정
 * - 7일 이내: 일할 계산 후 잔여액 부분 환불 및 구독 즉시 만료
 * - 7일 이후: 자동갱신만 해지, 만료일까지 유지
 */
export function decideCancellation(input: {
  paidAt: string | Date | null | undefined;
  amount: number;
  planType?: PlanType;
  now?: Date;
  alreadyRefunded?: boolean;
}): CancellationDecision {
  return calculateProratedRefund({
    amount: input.amount,
    planType: input.planType || "monthly",
    paidAt: input.paidAt,
    now: input.now,
    alreadyRefunded: input.alreadyRefunded,
  });
}
