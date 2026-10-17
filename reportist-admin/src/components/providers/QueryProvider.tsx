"use client";

import React, { useMemo } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { getQueryClient, createQueryPersister, CACHE_TIMES } from "@/lib/queryClient";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSubscription();
  const queryClient = useMemo(() => getQueryClient(), []);

  const persister = useMemo(() => {
    return createQueryPersister(user?.id);
  }, [user?.id]);

  const persistOptions = useMemo(() => {
    if (!persister) return undefined;
    return {
      persister,
      maxAge: CACHE_TIMES.LONG_24H,
      buster: "v1",
    };
  }, [persister]);

  if (!persistOptions) {
    return <>{children}</>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
