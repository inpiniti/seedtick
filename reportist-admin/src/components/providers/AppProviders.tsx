"use client";

import React from "react";
import { SubscriptionProvider, useSubscription } from "@/lib/subscription/SubscriptionContext";
import { ProUpgradeModal } from "@/components/subscription/ProUpgradeModal";
import { AuthModal } from "@/components/auth/AuthModal";

import { QueryProvider } from "@/components/providers/QueryProvider";
import { FeedbackFloatingButton } from "@/components/feedback/FeedbackFloatingButton";

function ModalsContainer() {
  const { isAuthModalOpen, closeAuthModal } = useSubscription();
  return (
    <>
      <ProUpgradeModal />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} />
      <FeedbackFloatingButton />
    </>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      <QueryProvider>
        {children}
        <ModalsContainer />
      </QueryProvider>
    </SubscriptionProvider>
  );
}
