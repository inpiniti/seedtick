"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { PaymentTransaction, Subscription, SubscriptionTier } from "./types";
import {
  calculateSubscriptionExpiry,
  isWelcomeTrialActive,
  getRemainingTrialHours,
  decideCancellation,
  CancellationDecision,
} from "./subscriptionPolicy";
import {
  requestBillingKey,
  requestOneTimePayment,
  PortOneResult,
} from "./portoneClient";

interface SubscriptionContextValue {
  user: User | null;
  tier: SubscriptionTier;
  isTrialActive: boolean;
  trialRemainingHours: number;
  subscription: Subscription | null;
  isLoading: boolean;
  isUpgradeModalOpen: boolean;
  upgradeModalReason: string | null;
  openUpgradeModal: (reason?: string) => void;
  closeUpgradeModal: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  upgradeToPro: (
    planType: "monthly" | "yearly",
    method?: "card" | "easypay"
  ) => Promise<{ success: boolean; message?: string }>;
  payments: PaymentTransaction[];
  /** 지금 해지하면 어떻게 처리되는지 미리 계산 (해지 확인 화면용) */
  previewCancellation: () => CancellationDecision;
  cancelSubscription: () => Promise<{ success: boolean; decision?: CancellationDecision; message?: string }>;
  toggleTierForTesting: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const STORAGE_KEY_TIER = "seedtick_demo_tier";
const STORAGE_KEY_EXPIRY = "seedtick_demo_expiry";
const STORAGE_KEY_PAYMENTS = "seedtick_demo_payments";

function readLocalPayments(): PaymentTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_PAYMENTS) || "[]");
  } catch {
    return [];
  }
}

function writeLocalPayments(list: PaymentTransaction[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(list));
  }
}

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [demoTier, setDemoTier] = useState<"pro" | "trial" | "free" | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  // 24시간 웰컴 무료 체험 활성 여부 계산
  const isTrialActive = React.useMemo(() => {
    if (tier === "pro") return false;
    if (demoTier === "trial") return true;
    if (demoTier === "free") return false;
    if (user?.created_at) {
      return isWelcomeTrialActive(user.created_at);
    }
    return false;
  }, [tier, demoTier, user?.created_at]);

  // 24시간 무료 체험 잔여 시간(시)
  const trialRemainingHours = React.useMemo(() => {
    if (demoTier === "trial") return 20;
    if (user?.created_at && isTrialActive) {
      return getRemainingTrialHours(user.created_at);
    }
    return 0;
  }, [demoTier, user?.created_at, isTrialActive]);

  // 로그인 성공 시: 로그인 모달을 닫고, 신규 가입/체험 유저가 아닐 때만 결제 모달 오픈
  useEffect(() => {
    if (user && isAuthModalOpen) {
      setIsAuthModalOpen(false);
      if (isTrialActive) {
        setUpgradeModalReason(null);
      } else if (upgradeModalReason && upgradeModalReason !== "24h_trial_welcome") {
        setIsUpgradeModalOpen(true);
      }
    }
  }, [user, isAuthModalOpen, upgradeModalReason, isTrialActive]);

  // 1. Supabase Auth 사용자 세션 및 로컬 상태 동기화
  useEffect(() => {
    // 로컬 스토리지에서 데모/저장된 구독 상태 로드
    if (typeof window !== "undefined") {
      setPayments(readLocalPayments());
      const savedTier = localStorage.getItem(STORAGE_KEY_TIER) as "pro" | "trial" | "free" | null;
      const savedExpiry = localStorage.getItem(STORAGE_KEY_EXPIRY);
      if (savedTier === "pro") {
        setTier("pro");
        setDemoTier("pro");
        setSubscription({
          id: "sub_demo",
          userId: "demo_user",
          tier: "pro",
          planType: "monthly",
          status: "active",
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: savedExpiry || calculateSubscriptionExpiry(null, "monthly").toISOString(),
        });
      } else if (savedTier === "trial") {
        setDemoTier("trial");
        setTier("free");
      } else if (savedTier === "free") {
        setDemoTier("free");
        setTier("free");
      }
    }

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Supabase 세션 체크
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserSubscription(session.user.id);
      }
      setIsLoading(false);
    });

    // Supabase Auth 상태 변경 리스너
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserSubscription(session.user.id);
      } else {
        // 비로그인 시 로컬 데모 상태가 없으면 free 유지
        const savedTier = localStorage.getItem(STORAGE_KEY_TIER) as "pro" | "trial" | "free" | null;
        if (savedTier === "pro") {
          setTier("pro");
        } else if (savedTier === "trial") {
          setDemoTier("trial");
          setTier("free");
        } else {
          setTier("free");
          setSubscription(null);
        }
      }
    });

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  // Supabase DB에서 유저 구독 정보 로드
  const loadUserSubscription = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        const sub = data as Subscription;
        // 만료일 검사
        if (sub.tier === "pro" && sub.currentPeriodEnd) {
          const isExpired = new Date(sub.currentPeriodEnd).getTime() < Date.now();
          if (isExpired) {
            setTier("free");
            return;
          }
        }
        setTier(sub.tier);
        setSubscription(sub);
      }

      const { data: payRows } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("paid_at", { ascending: false });
      if (payRows && payRows.length > 0) {
        setPayments(
          payRows.map((r) => ({
            id: r.merchant_uid,
            paymentId: r.imp_uid ?? r.merchant_uid ?? null,
            planType: r.plan_type,
            amount: Number(r.amount),
            payMethod: r.pay_method,
            cardLast4: r.card_last4 ?? null,
            status: r.status,
            receiptUrl: r.receipt_url ?? null,
            paidAt: r.paid_at,
          }))
        );
      }
    } catch (e) {
      console.warn("구독 정보 로드 예외:", e);
    }
  };

  const openUpgradeModal = useCallback((reason?: string) => {
    setUpgradeModalReason(reason || null);
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsUpgradeModalOpen(true);
  }, [user]);

  const closeUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(false);
    setUpgradeModalReason(null);
  }, []);

  // 포트원 결제 실행 및 Pro 승격
  const upgradeToPro = useCallback(
    async (
      planType: "monthly" | "yearly",
      method: "card" | "easypay" = "card"
    ): Promise<{ success: boolean; message?: string }> => {
      // 결제 전 로그인 필수 검증
      if (!user) {
        setIsUpgradeModalOpen(false);
        setIsAuthModalOpen(true);
        return {
          success: false,
          message: "멤버십 결제 및 계정 연동을 위해 먼저 로그인해 주세요.",
        };
      }

      const amount = planType === "monthly" ? 2900 : 29000;
      const orderName =
        planType === "monthly"
          ? "SeedTick Research Pro 멤버십 (월간 정기구독)"
          : "SeedTick Research Pro 멤버십 (1년 이용권)";

      let portoneRes: PortOneResult;

      if (planType === "monthly" && method === "card") {
        // 월간은 정기 결제 카드 등록 (빌링키 발급)
        portoneRes = await requestBillingKey({
          issueName: orderName,
          customerName: user?.email?.split("@")[0] || "SeedTick 회원",
          customerEmail: user?.email,
        });
      } else {
        // 단건/연간 결제
        const merchantUid = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        portoneRes = await requestOneTimePayment({
          merchantUid,
          orderName,
          amount,
          payMethod: method === "easypay" ? "EASY_PAY" : "CARD",
          customerName: user?.email?.split("@")[0] || "SeedTick 회원",
          customerEmail: user?.email,
        });
      }

      if (!portoneRes.success) {
        return {
          success: false,
          message: portoneRes.message || "결제가 취소되었거나 승인되지 않았습니다.",
        };
      }

      // 2. 서버 confirm API 호출 (포트원 결제 검증 및 서버 DB 기록)
      try {
        const token = supabase
          ? (await supabase.auth.getSession()).data.session?.access_token
          : undefined;

        const confirmRes = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            paymentId: portoneRes.paymentId,
            billingKey: portoneRes.billingKey,
            planType,
            payMethod: method === "easypay" ? "easypay" : "card",
          }),
        });

        const confirmJson = await confirmRes.json();
        if (!confirmJson.success) {
          return {
            success: false,
            message: confirmJson.message || "서버 결제 검증에 실패했습니다.",
          };
        }

        const verifiedSub = confirmJson.subscription as Subscription;
        const verifiedPay = confirmJson.payment as PaymentTransaction;

        setTier("pro");
        setSubscription(verifiedSub);
        setPayments((prev) => [verifiedPay, ...prev]);

        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_TIER, "pro");
          localStorage.setItem(
            STORAGE_KEY_EXPIRY,
            verifiedSub.currentPeriodEnd || ""
          );
        }

        closeUpgradeModal();
        return { success: true };
      } catch (err: unknown) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : "서버 결제 승인 요청 중 오류가 발생했습니다.",
        };
      }
    },
    [user, supabase, closeUpgradeModal]
  );

  const latestPaid = payments.find((p) => p.status === "paid") ?? null;

  const previewCancellation = useCallback(
    (): CancellationDecision =>
      decideCancellation({
        paidAt: latestPaid?.paidAt,
        amount: latestPaid?.amount ?? (subscription?.planType === "yearly" ? 29000 : 2900),
        planType: subscription?.planType || "monthly",
      }),
    [latestPaid, subscription?.planType]
  );

  // 구독 해지: 서버 cancel API를 통해 일할 계산 부분 환불 또는 자동갱신 해지 수행
  const cancelSubscription = useCallback(async () => {
    if (!subscription) return { success: false, message: "구독 정보가 없어요." };

    try {
      const token = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : undefined;

      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          paymentId: latestPaid?.paymentId,
          billingKey: subscription.billingKey,
          planType: subscription.planType,
        }),
      });

      const json = await res.json();
      if (!json.success) return { success: false, message: json.message };

      const decision = json.decision as CancellationDecision;
      const now = new Date().toISOString();

      if (decision.mode === "refund") {
        // 일할 계산 부분 환불 완료 -> 즉시 Free 전환
        setTier("free");
        setDemoTier("free");
        setSubscription({
          ...subscription,
          tier: "free",
          status: "expired",
          canceledAt: now,
          billingKey: null,
          currentPeriodEnd: now,
        });

        setPayments((prev) =>
          prev.map((p) =>
            p.id === latestPaid?.id
              ? {
                  ...p,
                  status: "refunded",
                }
              : p
          )
        );

        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY_TIER, "free");
          localStorage.removeItem(STORAGE_KEY_EXPIRY);
        }
      } else {
        // 7일 초과: 다음 결제만 해지, 만료일까지 유지
        setSubscription({
          ...subscription,
          status: "canceled",
          canceledAt: now,
          billingKey: null,
        });
      }

      return { success: true, decision };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : "해지 요청에 실패했어요.",
      };
    }
  }, [subscription, supabase, latestPaid]);

  // 개발 및 시연용 Free <-> 1-Day Trial <-> Pro 3단계 즉각 토글 헬퍼
  const toggleTierForTesting = useCallback(() => {
    // 1. 현재 1일 무료 체험 중인 경우 -> Pro로 전환
    if (isTrialActive || demoTier === "trial") {
      const expiry = calculateSubscriptionExpiry(null, "monthly").toISOString();
      setDemoTier("pro");
      setTier("pro");
      setSubscription({
        id: "sub_demo_toggle",
        userId: user?.id || "demo_user",
        tier: "pro",
        planType: "monthly",
        status: "active",
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: expiry,
      });
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TIER, "pro");
        localStorage.setItem(STORAGE_KEY_EXPIRY, expiry);
      }
    } else if (tier === "pro") {
      // 2. 현재 Pro인 경우 -> 일반 Free(체험 만료)로 전환
      setDemoTier("free");
      setTier("free");
      setSubscription(null);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TIER, "free");
        localStorage.removeItem(STORAGE_KEY_EXPIRY);
      }
    } else {
      // 3. 현재 Free인 경우 -> 1일 무료 체험(Trial)으로 전환
      setDemoTier("trial");
      setTier("free");
      setSubscription(null);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TIER, "trial");
        localStorage.removeItem(STORAGE_KEY_EXPIRY);
      }
    }
  }, [demoTier, isTrialActive, tier, user]);

  return (
    <SubscriptionContext.Provider
      value={{
        user,
        tier,
        isTrialActive,
        trialRemainingHours,
        subscription,
        isLoading,
        isUpgradeModalOpen,
        upgradeModalReason,
        openUpgradeModal,
        closeUpgradeModal,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        upgradeToPro,
        payments,
        previewCancellation,
        cancelSubscription,
        toggleTierForTesting,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
