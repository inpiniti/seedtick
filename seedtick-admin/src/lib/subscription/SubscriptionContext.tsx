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

      let portoneRes;

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

      // 만료일 산출
      const currentEnd = subscription?.currentPeriodEnd || null;
      const newExpiry = calculateSubscriptionExpiry(currentEnd, planType);
      const newExpiryStr = newExpiry.toISOString();

      // 상태 업데이트
      const updatedSub: Subscription = {
        id: subscription?.id || `sub_${Date.now()}`,
        userId: user?.id || "demo_user",
        tier: "pro",
        planType,
        status: "active",
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: newExpiryStr,
        billingKey: portoneRes.billingKey,
      };

      setTier("pro");
      setSubscription(updatedSub);

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TIER, "pro");
        localStorage.setItem(STORAGE_KEY_EXPIRY, newExpiryStr);
      }

      // 결제 내역 기록
      const payment: PaymentTransaction = {
        id: `txn_${Date.now()}`,
        paymentId: portoneRes.paymentId ?? portoneRes.billingKey ?? null,
        planType,
        amount,
        payMethod: method === "easypay" ? "easypay" : "card",
        cardLast4: null,
        status: "paid",
        receiptUrl: null,
        paidAt: new Date().toISOString(),
      };
      setPayments((prev) => {
        const next = [payment, ...prev];
        writeLocalPayments(next);
        return next;
      });
      if (supabase && user) {
        supabase
          .from("payment_transactions")
          .insert({
            user_id: user.id,
            merchant_uid: payment.id,
            imp_uid: payment.paymentId,
            amount,
            plan_type: planType,
            pay_method: payment.payMethod,
            status: "paid",
            paid_at: payment.paidAt,
          })
          .then(({ error }) => {
            if (error) console.warn("결제 내역 DB 기록 실패:", error.message);
          });
      }

      // Supabase DB 저장 (로그인 상태인 경우)
      if (supabase && user) {
        try {
          await supabase.from("subscriptions").upsert({
            user_id: user.id,
            tier: "pro",
            plan_type: planType,
            status: "active",
            current_period_start: updatedSub.currentPeriodStart,
            current_period_end: updatedSub.currentPeriodEnd,
            billing_key: portoneRes.billingKey || null,
            updated_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn("DB 구독 동기화 실패 (로컬 상태는 Pro 유지됨):", dbErr);
        }
      }

      closeUpgradeModal();
      return { success: true };
    },
    [user, subscription, closeUpgradeModal]
  );

  const latestPaid = payments.find((p) => p.status === "paid") ?? null;

  const previewCancellation = useCallback(
    (): CancellationDecision =>
      decideCancellation({
        paidAt: latestPaid?.paidAt,
        amount: latestPaid?.amount ?? 0,
      }),
    [latestPaid]
  );

  // 구독 해지: 7일 이내 전액 환불(즉시 만료) / 이후는 자동갱신만 해지(만료일까지 Pro 유지)
  const cancelSubscription = useCallback(async () => {
    if (!subscription) return { success: false, message: "구독 정보가 없어요." };
    const decision = previewCancellation();

    // 서버에서 포트원 API 호출 (결제 취소 또는 빌링키 삭제)
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
          mode: decision.mode,
          paymentId: latestPaid?.paymentId,
          billingKey: subscription.billingKey,
          refundAmount: decision.refundAmount,
        }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, message: json.message };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : "해지 요청에 실패했어요." };
    }

    const now = new Date().toISOString();
    const canceledSub: Subscription = {
      ...subscription,
      status: decision.mode === "refund" ? "expired" : "canceled",
      canceledAt: now,
      billingKey: null,
      currentPeriodEnd: decision.mode === "refund" ? now : subscription.currentPeriodEnd,
    };
    setSubscription(canceledSub);

    if (decision.mode === "refund") {
      setTier("free");
      setDemoTier("free");
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TIER, "free");
        localStorage.removeItem(STORAGE_KEY_EXPIRY);
      }
      setPayments((prev) => {
        const next = prev.map((p) =>
          p.id === latestPaid?.id ? { ...p, status: "refunded" as const } : p
        );
        writeLocalPayments(next);
        return next;
      });
    }

    if (supabase && user) {
      await supabase
        .from("subscriptions")
        .update({
          status: canceledSub.status,
          canceled_at: now,
          billing_key: null,
          current_period_end: canceledSub.currentPeriodEnd,
          tier: decision.mode === "refund" ? "free" : subscription.tier,
          updated_at: now,
        })
        .eq("user_id", user.id);
      if (decision.mode === "refund" && latestPaid) {
        await supabase
          .from("payment_transactions")
          .update({ status: "refunded" })
          .eq("merchant_uid", latestPaid.id);
      }
    }

    return { success: true, decision };
  }, [subscription, user, previewCancellation, latestPaid]);

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
