"use client";

import React from "react";
import { SubscriptionProvider, useSubscription } from "@/lib/subscription/SubscriptionContext";
import { ProUpgradeModal } from "@/components/subscription/ProUpgradeModal";
import { AuthModal } from "@/components/auth/AuthModal";

function ModalsContainer() {
  const { isAuthModalOpen, closeAuthModal } = useSubscription();
  return (
    <>
      <ProUpgradeModal />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} />
    </>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      {children}
      <ModalsContainer />
    </SubscriptionProvider>
  );
}
