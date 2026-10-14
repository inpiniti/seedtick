"use client";

import React from "react";
import { SubscriptionProvider } from "@/lib/subscription/SubscriptionContext";
import { ProUpgradeModal } from "@/components/subscription/ProUpgradeModal";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionProvider>
      {children}
      <ProUpgradeModal />
    </SubscriptionProvider>
  );
}
