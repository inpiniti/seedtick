"use client";

import { useEffect, useRef, useState } from "react";

const ANALYZER_URL =
  process.env.NEXT_PUBLIC_ANALYZER_URL?.replace(/\/$/, "") || "http://localhost:8000";

export interface RealtimeTick {
  price: number;
  /** 이전 체결가 (등락 방향 표시용) */
  prevPrice: number | null;
  /** 마지막 수신 시각 (ISO) */
  updatedAt: string;
}

export interface RealtimePricesState {
  /** 티커별 최신 체결가 */
  prices: Record<string, RealtimeTick>;
  /** SSE 연결 상태 */
  isConnected: boolean;
  /** 마지막으로 체결가를 수신한 시각 (ISO) */
  lastTickAt: string | null;
}

/**
 * 서버 SSE(/api/grid-trading/prices/stream) 구독을 통해 종목별 실시간 체결가를 수신합니다.
 * - 최초 스냅샷(snapshot) + 이후 틱(tick) 이벤트를 모두 처리합니다.
 * - 연결 끊김 시 지수 백오프로 자동 재연결합니다.
 */
export function useRealtimePrices(enabled = true): RealtimePricesState {
  const [state, setState] = useState<RealtimePricesState>({
    prices: {},
    isConnected: false,
    lastTickAt: null,
  });

  // 재연결 타이머/상태는 리렌더마다 초기화되지 않도록 ref로 유지
  const retryCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    closedRef.current = false;

    const connect = () => {
      if (closedRef.current) return;

      const source = new EventSource(`${ANALYZER_URL}/api/grid-trading/prices/stream`);
      sourceRef.current = source;

      source.onopen = () => {
        retryCountRef.current = 0;
        setState((prev) => ({ ...prev, isConnected: true }));
      };

      // 1. 초기 스냅샷: { prices: { TICKER: price } }
      source.addEventListener("snapshot", (e) => {
        const raw = (e as MessageEvent).data;
        try {
          const parsed = JSON.parse(raw) as { prices?: Record<string, number> };
          const incoming = parsed.prices ?? {};
          setState((prev) => {
            const next = { ...prev.prices };
            for (const [ticker, price] of Object.entries(incoming)) {
              next[ticker.toUpperCase()] = {
                price,
                prevPrice: next[ticker.toUpperCase()]?.price ?? null,
                updatedAt: new Date().toISOString(),
              };
            }
            return { ...prev, prices: next };
          });
        } catch {
          // 파싱 실패는 무시 (다음 틱에서 복구)
        }
      });

      // 2. 실시간 틱: { type, ticker, price }
      source.addEventListener("tick", (e) => {
        const raw = (e as MessageEvent).data;
        try {
          const parsed = JSON.parse(raw) as { ticker?: string; price?: number };
          const ticker = parsed.ticker?.toUpperCase();
          const price = parsed.price;
          if (!ticker || typeof price !== "number" || price <= 0) return;

          const now = new Date().toISOString();
          setState((prev) => {
            const sym = ticker;
            const prevTick = prev.prices[sym];
            // 가격이 그대로면 prevPrice를 갱신하지 않아 불필요한 리렌더를 막는다.
            if (prevTick && prevTick.price === price) return prev;
            return {
              ...prev,
              prices: {
                ...prev.prices,
                [sym]: { price, prevPrice: prevTick?.price ?? null, updatedAt: now },
              },
              lastTickAt: now,
            };
          });
        } catch {
          // 파싱 실패는 무시
        }
      });

      source.onerror = () => {
        // EventSource 는 자동 재연결을 시도하지만, 지수 백오프를 적용하기 위해 직접 제어한다.
        setState((prev) => ({ ...prev, isConnected: false }));
        try {
          source.close();
        } catch {
          // 이미 닫힌 경우 무시
        }
        if (closedRef.current) return;

        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
        retryCountRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (sourceRef.current) {
        try {
          sourceRef.current.close();
        } catch {
          // 이미 닫힌 경우 무시
        }
        sourceRef.current = null;
      }
    };
  }, [enabled]);

  return state;
}