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
import { PlanType, Subscription, SubscriptionTier } from "./types";
import { calculateSubscriptionExpiry } from "./subscriptionPolicy";
import {
  requestBillingKey,
  requestOneTimePayment,
} from "./portoneClient";

interface SubscriptionContextValue {
  user: User | null;
  tier: SubscriptionTier;
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
  cancelSubscription: () => Promise<void>;
  toggleTierForTesting: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const STORAGE_KEY_TIER = "seedtick_demo_tier";
const STORAGE_KEY_EXPIRY = "seedtick_demo_expiry";

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  // 로그인 성공 시: 로그인 모달을 닫고, 이전에 업그레이드 모달을 요청했었다면 결제 모달 오픈
  useEffect(() => {
    if (user && isAuthModalOpen) {
      setIsAuthModalOpen(false);
      if (upgradeModalReason) {
        setIsUpgradeModalOpen(true);
      }
    }
  }, [user, isAuthModalOpen, upgradeModalReason]);

  // 1. Supabase Auth 사용자 세션 및 로컬 상태 동기화
  useEffect(() => {
    // 로컬 스토리지에서 데모/저장된 구독 상태 로드
    if (typeof window !== "undefined") {
      const savedTier = localStorage.getItem(STORAGE_KEY_TIER) as SubscriptionTier | null;
      const savedExpiry = localStorage.getItem(STORAGE_KEY_EXPIRY);
      if (savedTier === "pro") {
        setTier("pro");
        setSubscription({
          id: "sub_demo",
          userId: "demo_user",
          tier: "pro",
          planType: "monthly",
          status: "active",
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: savedExpiry || calculateSubscriptionExpiry(null, "monthly").toISOString(),
        });
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
        const savedTier = localStorage.getItem(STORAGE_KEY_TIER) as SubscriptionTier | null;
        if (savedTier !== "pro") {
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

  // 구독 해지 (다음 주기 결제 취소, 마감일까지는 Pro 유지)
  const cancelSubscription = useCallback(async () => {
    if (!subscription) return;
    const canceledSub: Subscription = {
      ...subscription,
      status: "canceled",
      canceledAt: new Date().toISOString(),
    };
    setSubscription(canceledSub);

    if (supabase && user) {
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: canceledSub.canceledAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }
  }, [subscription, user]);

  // 개발 및 시연용 Free <-> Pro 즉각 토글 헬퍼
  const toggleTierForTesting = useCallback(() => {
    if (tier === "free") {
      const expiry = calculateSubscriptionExpiry(null, "monthly").toISOString();
      setTier("pro");
      setSubscription({
        id: "sub_test",
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
    } else {
      setTier("free");
      setSubscription(null);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_TIER, "free");
        localStorage.removeItem(STORAGE_KEY_EXPIRY);
      }
    }
  }, [tier, user]);

  return (
    <SubscriptionContext.Provider
      value={{
        user,
        tier,
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
