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
  isWelcomeTrialActive,
  getRemainingTrialHours,
  decideCancellation,
  CancellationDecision,
  getPlanAmount,
} from "./subscriptionPolicy";
import {
  requestBillingKey,
  requestOneTimePayment,
  PortOneResult,
} from "./portoneClient";

interface SubscriptionContextValue {
  user: User | null;
  tier: SubscriptionTier;
  isAdmin: boolean;
  isAdminLoading: boolean;
  refreshAdminStatus: () => Promise<void>;
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
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  // 24시간 웰컴 무료 체험 활성 여부 계산 (로그인 유저의 가입 시각 기준)
  const isTrialActive = React.useMemo(() => {
    if (tier === "pro") return false;
    if (user?.created_at) {
      return isWelcomeTrialActive(user.created_at);
    }
    return false;
  }, [tier, user]);

  // 24시간 무료 체험 잔여 시간(시)
  const trialRemainingHours = React.useMemo(() => {
    if (user?.created_at && isTrialActive) {
      return getRemainingTrialHours(user.created_at);
    }
    return 0;
  }, [user, isTrialActive]);

  // 서버에서 구독 진실을 조회 (유일한 데이터 출처 — localStorage를 신뢰하지 않음)
  const refreshSubscription = useCallback(async () => {
    if (!supabase) return;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setTier("free");
        setSubscription(null);
        setPayments([]);
        return;
      }
      const res = await fetch("/api/billing/status", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (json?.success) {
        const sub = (json.subscription ?? null) as Subscription | null;
        setSubscription(sub);
        setTier(sub?.tier ?? "free");
        setPayments((json.payments ?? []) as PaymentTransaction[]);
      } else {
        // 조회 실패 시 등급을 올려주지 않음 (fail-closed)
        console.warn("구독 상태 조회 실패:", json?.message);
      }
    } catch (e) {
      console.warn("구독 상태 조회 예외:", e);
    }
  }, []);

  const loadUserSubscription = refreshSubscription;

  // 관리자 여부 조회 (UX 게이팅용 — 진짜 인가는 서버 API가 수행, fail-closed)
  const refreshAdminStatus = useCallback(async () => {
    if (!supabase) {
      setIsAdmin(false);
      setIsAdminLoading(false);
      return;
    }
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setIsAdmin(false);
        setIsAdminLoading(false);
        return;
      }
      const res = await fetch("/api/admin/status", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      setIsAdmin(json?.success === true && json?.isAdmin === true);
    } catch {
      setIsAdmin(false);
    } finally {
      setIsAdminLoading(false);
    }
  }, []);

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

  // Supabase Auth 사용자 세션 동기화 + 서버 구독 상태 로드
  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Supabase 세션 체크
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserSubscription();
        refreshAdminStatus();
      } else {
        setTier("free");
        setSubscription(null);
        setPayments([]);
        setIsAdmin(false);
        setIsAdminLoading(false);
      }
      setIsLoading(false);
    });

    // Supabase Auth 상태 변경 리스너
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserSubscription();
        refreshAdminStatus();
      } else {
        setTier("free");
        setSubscription(null);
        setPayments([]);
        setIsAdmin(false);
        setIsAdminLoading(false);
      }
    });

    return () => {
      authListener.unsubscribe();
    };
  }, [loadUserSubscription, refreshAdminStatus]);

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
  // 흐름: (월간) 브라우저에서 카드 등록(빌링키 발급) → 서버가 검증+직접 청구
  //       (연간) 브라우저에서 단건 결제 → 서버가 PortOne 재조회로 검증
  // 최종 PRO 부여는 서버 DB 기록 성공 시에만 이뤄집니다.
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

      const amount = getPlanAmount(planType);
      const orderName =
        planType === "monthly"
          ? "Reportist Research Pro 멤버십 (월간 정기구독)"
          : "Reportist Research Pro 멤버십 (1년 이용권)";

      let portoneRes: PortOneResult;

      if (planType === "monthly" && method === "card") {
        // 월간은 정기 결제 카드 등록 (빌링키 발급) — 실제 과금은 서버가 수행
        portoneRes = await requestBillingKey({
          issueName: orderName,
          customerId: user.id,
          customerName: user?.email?.split("@")[0] || "Reportist 회원",
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
          customerId: user.id,
          customerName: user?.email?.split("@")[0] || "Reportist 회원",
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

        // 서버가 기록한 값을 그대로 반영한 뒤 서버 진실로 재동기화
        if (verifiedSub) {
          setTier(verifiedSub.tier);
          setSubscription(verifiedSub);
        }
        if (verifiedPay) {
          setPayments((prev) => {
            if (prev.some((p) => p.id === verifiedPay.id)) return prev;
            return [verifiedPay, ...prev];
          });
        }
        await refreshSubscription();

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
    [user, closeUpgradeModal, refreshSubscription]
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

  // 구독 해지: 서버 cancel API가 DB 기준으로 일할 계산 부분 환불 또는 자동갱신 해지 수행
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
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!json.success) return { success: false, message: json.message };

      const decision = json.decision as CancellationDecision;

      // 서버 진실로 재동기화 (클라이언트에서 상태를 직접 계산하지 않음)
      await refreshSubscription();

      return { success: true, decision };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : "해지 요청에 실패했어요.",
      };
    }
  }, [subscription, refreshSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        user,
        tier,
        isAdmin,
        isAdminLoading,
        refreshAdminStatus,
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
        refreshSubscription,
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
