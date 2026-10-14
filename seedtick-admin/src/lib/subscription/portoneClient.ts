/**
 * PortOne (구 아임포트) V2 SDK 연동 헬퍼
 * 공식 V2 스크립트: https://cdn.portone.io/v2/browser-sdk.js
 */

export interface PortOnePaymentParams {
  merchantUid: string;
  orderName: string;
  amount: number;
  customerName?: string;
  customerEmail?: string;
  payMethod?: "CARD" | "EASY_PAY" | "TRANSFER";
}

export interface PortOneBillingKeyParams {
  issueName: string;
  customerName?: string;
  customerEmail?: string;
}

export interface PortOneResult {
  success: boolean;
  paymentId?: string;
  billingKey?: string;
  code?: string;
  message?: string;
}

// 브라우저 전역 PortOne SDK 타입 선언
declare global {
  interface Window {
    PortOne?: {
      requestPayment: (options: Record<string, unknown>) => Promise<{
        code?: string;
        message?: string;
        paymentId?: string;
      }>;
      requestIssueBillingKey: (options: Record<string, unknown>) => Promise<{
        code?: string;
        message?: string;
        billingKey?: string;
      }>;
    };
  }
}

const STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "store-test-seedtick";
const CHANNEL_KEY_CARD = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD || "channel-key-card-test";
const CHANNEL_KEY_EASYPAY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_EASYPAY || "channel-key-easypay-test";

/**
 * PortOne V2 브라우저 SDK를 동적으로 로드합니다.
 */
export async function loadPortOneSdk(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.PortOne) return true;

  return new Promise((resolve) => {
    const existingScript = document.getElementById("portone-v2-sdk");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "portone-v2-sdk";
    script.src = "https://cdn.portone.io/v2/browser-sdk.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("PortOne SDK 로드 실패 - 시뮬레이션 모드로 전환합니다.");
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * 포트원 V2 신용카드 빌링키 발급 요청 (정기 자동 결제용)
 */
export async function requestBillingKey(
  params: PortOneBillingKeyParams
): Promise<PortOneResult> {
  const isLoaded = await loadPortOneSdk();

  // 테스트/데모 환경이거나 포트원 키가 설정되지 않은 경우 시뮬레이션 지원
  if (!isLoaded || !window.PortOne || STORE_ID.includes("test")) {
    console.info("[PortOne] 테스트/시뮬레이션 모드로 빌링키를 발급합니다:", params);
    await new Promise((r) => setTimeout(r, 800));
    return {
      success: true,
      billingKey: `billing_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  try {
    const response = await window.PortOne.requestIssueBillingKey({
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY_CARD,
      issueName: params.issueName,
      customer: {
        fullName: params.customerName || "SeedTick 회원",
        email: params.customerEmail,
      },
    });

    if (response.code != null) {
      return {
        success: false,
        code: response.code,
        message: response.message || "빌링키 발급에 실패했습니다.",
      };
    }

    return {
      success: true,
      billingKey: response.billingKey,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

/**
 * 포트원 V2 일반 단건 결제 요청 (카드, 간편결제 등)
 */
export async function requestOneTimePayment(
  params: PortOnePaymentParams
): Promise<PortOneResult> {
  const isLoaded = await loadPortOneSdk();

  if (!isLoaded || !window.PortOne || STORE_ID.includes("test")) {
    console.info("[PortOne] 테스트/시뮬레이션 모드로 결제를 진행합니다:", params);
    await new Promise((r) => setTimeout(r, 800));
    return {
      success: true,
      paymentId: `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  try {
    const channelKey =
      params.payMethod === "EASY_PAY" ? CHANNEL_KEY_EASYPAY : CHANNEL_KEY_CARD;

    const response = await window.PortOne.requestPayment({
      storeId: STORE_ID,
      channelKey,
      paymentId: params.merchantUid,
      orderName: params.orderName,
      totalAmount: params.amount,
      currency: "CURRENCY_KRW",
      payMethod: params.payMethod || "CARD",
      customer: {
        fullName: params.customerName || "SeedTick 회원",
        email: params.customerEmail,
      },
    });

    if (response.code != null) {
      return {
        success: false,
        code: response.code,
        message: response.message || "결제 처리에 실패했습니다.",
      };
    }

    return {
      success: true,
      paymentId: response.paymentId,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}
