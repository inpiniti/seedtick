import { sendGAEvent } from "@next/third-parties/google";

/**
 * Google Tag Manager (GTM) 및 Google Analytics 4 (GA4) 통합 이벤트 전송 헬퍼
 */
export function trackEvent(
  eventName: string,
  parameters?: Record<string, string | number | boolean | undefined>
) {
  if (typeof window === "undefined") return;

  // 1. GTM dataLayer 전송 (GTM 태그/트리거 연동)
  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({
        event: eventName,
        ...(parameters ?? {}),
      });
    }
  } catch (error) {
    console.debug("[Analytics] Failed to push to dataLayer:", eventName, error);
  }

  // 2. 직접 GA4 연결 시 sendGAEvent 전송
  if (process.env.NEXT_PUBLIC_GA_ID) {
    try {
      sendGAEvent("event", eventName, parameters ?? {});
    } catch (error) {
      console.debug("[Analytics] Failed to send direct GA event:", eventName, error);
    }
  }
}

/**
 * 리포티스트 핵심 사용자 액션별 타입 세이프 트래커
 */
export const analytics = {
  // 종목 검색
  search: (query: string) => {
    trackEvent("search", {
      search_term: query,
    });
  },

  // 종목 리포트 열람 (표준 view_item 이벤트)
  viewReport: (ticker: string, companyName?: string) => {
    trackEvent("view_item", {
      content_type: "stock_report",
      item_id: ticker,
      item_name: companyName || ticker,
    });
  },

  // 거장 투자 원칙 상세 보기
  viewGuru: (guruId: string, guruName?: string) => {
    trackEvent("select_content", {
      content_type: "guru_philosophy",
      item_id: guruId,
      item_name: guruName || guruId,
    });
  },

  // 대시보드 탭 전환 (chart, catalog, screener, outcomes, logs)
  switchTab: (tabId: string) => {
    trackEvent("switch_tab", {
      tab_id: tabId,
    });
  },

  // 유료 멤버십 업그레이드 클릭 / 플랜 확인
  clickUpgrade: (source: string) => {
    trackEvent("click_upgrade", {
      source,
    });
  },

  // 결제 시작 (표준 begin_checkout 이벤트)
  beginCheckout: (planId: string, price?: number) => {
    trackEvent("begin_checkout", {
      currency: "KRW",
      value: price,
      item_id: planId,
    });
  },

  // 로그인 / 가입 모달 열람
  openAuthModal: (trigger: string) => {
    trackEvent("open_auth_modal", {
      trigger,
    });
  },
};
