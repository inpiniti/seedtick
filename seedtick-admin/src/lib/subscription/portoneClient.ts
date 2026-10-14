/**
 * PortOne (구 아임포트) V2 SDK 연동 헬퍼
 * 공식 V2 스크립트: https://cdn.portone.io/v2/browser-sdk.js
 */

export interface PortOnePaymentParams {
  merchantUid: string;
  orderName: string;
  amount: number;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  payMethod?: "CARD" | "EASY_PAY" | "TRANSFER";
}

export interface PortOneBillingKeyParams {
  issueName: string;
  customerId?: string;
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

// 1. 정기 결제(카드 등록/빌링키) 전용 채널키
const CHANNEL_KEY_BILLING =
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_BILLING ||
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD ||
  "channel-key-card-test";

// 2. 일반 단건 결제(1년 이용권 등) 전용 채널키
const CHANNEL_KEY_ONETIME =
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_ONETIME ||
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD ||
  CHANNEL_KEY_BILLING;

// 3. 간편결제(카카오페이 등) 채널키 (없으면 일반 결제 채널키로 폴백)
const CHANNEL_KEY_EASYPAY =
  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_EASYPAY || CHANNEL_KEY_ONETIME;

/**
 * 개발 시뮬레이션 허용 여부.
 * 명시적으로 NEXT_PUBLIC_ALLOW_DEV_SIMULATION=true 일 때만 가짜 성공을 반환합니다.
 * 운영에서는 절대 가짜 성공을 반환하지 않습니다 (fail-closed).
 */
function isDevSimulationAllowed(): boolean {
  return (
    typeof window !== "undefined" &&
    (process.env.NEXT_PUBLIC_ALLOW_DEV_SIMULATION as string | undefined) ===
      "true"
  );
}

function simulationRejected(): PortOneResult {
  return {
    success: false,
    message:
      "결제 모듈을 불러오지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해 주세요.",
  };
}

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

  // SDK를 못 불러오면: 개발 시뮬레이션 허용 시에만 가짜 성공, 아니면 실패
  if (!isLoaded || !window.PortOne) {
    if (!isDevSimulationAllowed()) return simulationRejected();
    console.info("[PortOne] 개발 시뮬레이션 모드로 빌링키를 발급합니다:", params);
    await new Promise((r) => setTimeout(r, 800));
    return {
      success: true,
      billingKey: `billing_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  try {
    const issueId = `issue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const response = await window.PortOne.requestIssueBillingKey({
      storeId: STORE_ID,
      channelKey: CHANNEL_KEY_BILLING,
      billingKeyMethod: "CARD",
      issueId,
      issueName: params.issueName,
      customer: {
        ...(params.customerId ? { id: params.customerId } : {}),
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

  if (!isLoaded || !window.PortOne) {
    if (!isDevSimulationAllowed()) return simulationRejected();
    console.info("[PortOne] 개발 시뮬레이션 모드로 결제를 진행합니다:", params);
    await new Promise((r) => setTimeout(r, 800));
    return {
      success: true,
      paymentId: `pay_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  try {
    const channelKey =
      params.payMethod === "EASY_PAY" ? CHANNEL_KEY_EASYPAY : CHANNEL_KEY_ONETIME;

    const response = await window.PortOne.requestPayment({
      storeId: STORE_ID,
      channelKey,
      paymentId: params.merchantUid,
      orderName: params.orderName,
      totalAmount: params.amount,
      currency: "CURRENCY_KRW",
      payMethod: params.payMethod || "CARD",
      customer: {
        ...(params.customerId ? { id: params.customerId } : {}),
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
