export type SubscriptionTier = "free" | "pro";

export type PlanType = "monthly" | "yearly" | "none";

export type SubscriptionStatus = "active" | "canceled" | "past_due" | "expired";

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  billingKey?: string | null;
  canceledAt?: string | null;
}

export type PaymentStatus = "paid" | "failed" | "refunded";

export interface PaymentTransaction {
  id: string;
  /** 포트원 paymentId (단건) 또는 빌링 결제 ID */
  paymentId: string | null;
  planType: "monthly" | "yearly";
  amount: number;
  payMethod: string;
  /** 카드 끝 4자리 (있을 때만) */
  cardLast4?: string | null;
  status: PaymentStatus;
  receiptUrl?: string | null;
  paidAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  authProvider: string;
  createdAt: string;
}

export interface PlanPricingItem {
  id: PlanType;
  name: string;
  price: number;
  originalPrice?: number;
  periodLabel: string;
  badge?: string;
  features: string[];
}

export const PRICING_PLANS: Record<"monthly" | "yearly", PlanPricingItem> = {
  monthly: {
    id: "monthly",
    name: "월간 플랜",
    price: 2900,
    periodLabel: "/ 월",
    badge: "가장 인기있는 선택",
    features: [
      "13인의 전설적 투자 거장 AI 실시간 가치평가 및 종합 보고서",
      "SEC 공시 원문 기반 실시간 심층 재무 데이터팩 전체 열람",
      "최신 1개월 리서치 리포트 즉시 열람",
      "적정주가 밴드 및 Bull/Bear 시나리오 세부 데이터",
      "신용카드로 매월 자동 결제 (언제든 1초 만에 해지 가능)",
    ],
  },
  yearly: {
    id: "yearly",
    name: "연간 플랜",
    price: 29000,
    originalPrice: 34800,
    periodLabel: "/ 년",
    badge: "17% 할인 (2개월 무료)",
    features: [
      "월간 플랜의 모든 혜택 동일 제공",
      "연간 5,800원 절약 (2달 무료 이용 효과)",
      "카드 정기 자동결제 또는 간편결제(카카오페이/토스페이) 지원",
      "1년 동안 가격 인상 없는 멤버십 혜택 동결",
    ],
  },
};
