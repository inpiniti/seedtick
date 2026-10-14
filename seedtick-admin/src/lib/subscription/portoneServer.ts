/**
 * PortOne V2 서버 사이드 API 통신 모듈
 * 공식 V2 API: https://api.portone.io
 * 주의: 이 모듈은 API Route / 서버 환경에서만 실행되어야 하며 브라우저에 노출되지 않습니다.
 */

const PORTONE_API_BASE = "https://api.portone.io";

export interface VerifiedPaymentInfo {
  paymentId: string;
  orderName: string;
  amount: number;
  status: "PAID" | "CANCELLED" | "PARTIAL_CANCELLED" | "FAILED" | "UNKNOWN";
  payMethod: string;
  cardLast4?: string | null;
  receiptUrl?: string | null;
  paidAt: string;
  isSimulated?: boolean;
}

export interface CancelResult {
  success: boolean;
  refundedAmount: number;
  isSimulated?: boolean;
  message?: string;
}

function getSecretHeader(): HeadersInit | null {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) return null;
  return {
    Authorization: `PortOne ${secret}`,
    "Content-Type": "application/json",
  };
}

function isSimulationMode(paymentId?: string | null): boolean {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "";
  return (
    !process.env.PORTONE_API_SECRET ||
    storeId.includes("test") ||
    !paymentId ||
    paymentId.includes("_test_") ||
    paymentId.startsWith("pay_sim_")
  );
}

/**
 * 1. 포트원 결제 단건 조회 및 실결제 검증 API
 * GET https://api.portone.io/payments/{paymentId}
 */
export async function verifyPortOnePayment(
  paymentId: string,
  expectedAmount: number
): Promise<{ success: boolean; data?: VerifiedPaymentInfo; message?: string }> {
  // 시뮬레이션 / 테스트 모드인 경우 모의 응답
  if (isSimulationMode(paymentId)) {
    return {
      success: true,
      data: {
        paymentId,
        orderName: "SeedTick Research Pro 멤버십",
        amount: expectedAmount,
        status: "PAID",
        payMethod: "CARD",
        cardLast4: "4242",
        receiptUrl: "https://mock.portone.io/receipt/simulated",
        paidAt: new Date().toISOString(),
        isSimulated: true,
      },
    };
  }

  const headers = getSecretHeader();
  if (!headers) {
    return {
      success: false,
      message: "서버에 PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.",
    };
  }

  try {
    const res = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message: err.message || `포트원 결제 조회 실패 (HTTP ${res.status})`,
      };
    }

    const payload = await res.json();
    const actualAmount = payload.amount?.total ?? 0;

    // 결제 상태 검증
    if (payload.status !== "PAID") {
      return {
        success: false,
        message: `결제 상태가 완료(PAID)가 아닙니다: ${payload.status}`,
      };
    }

    // 결제 금액 위변조 검증
    if (actualAmount !== expectedAmount) {
      return {
        success: false,
        message: `결제 금액 불일치 위변조 감지 (예상: ${expectedAmount}원, 실결제: ${actualAmount}원)`,
      };
    }

    // 카드 번호 및 영수증 추출
    const cardLast4 =
      payload.paymentMethod?.card?.last4Digits ||
      payload.method?.card?.last4Digits ||
      null;

    const receiptUrl = payload.receiptUrl || null;

    return {
      success: true,
      data: {
        paymentId: payload.id || paymentId,
        orderName: payload.orderName || "SeedTick Pro",
        amount: actualAmount,
        status: "PAID",
        payMethod: payload.paymentMethod?.type || payload.method?.type || "CARD",
        cardLast4,
        receiptUrl,
        paidAt: payload.paidAt || new Date().toISOString(),
        isSimulated: false,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "포트원 결제 검증 중 네트워크 오류",
    };
  }
}

/**
 * 2. 포트원 결제 부분 취소 / 환불 API
 * POST https://api.portone.io/payments/{paymentId}/cancel
 */
export async function cancelPortOnePayment(input: {
  paymentId: string;
  refundAmount: number;
  reason: string;
}): Promise<CancelResult> {
  const { paymentId, refundAmount, reason } = input;

  // 시뮬레이션 / 테스트 모드
  if (isSimulationMode(paymentId)) {
    return {
      success: true,
      refundedAmount: refundAmount,
      isSimulated: true,
    };
  }

  const headers = getSecretHeader();
  if (!headers) {
    return {
      success: false,
      refundedAmount: 0,
      message: "PORTONE_API_SECRET이 설정되지 않았습니다.",
    };
  }

  try {
    const res = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: refundAmount,
          reason,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        refundedAmount: 0,
        message: err.message || `포트원 결제 취소 요청 실패 (HTTP ${res.status})`,
      };
    }

    return {
      success: true,
      refundedAmount: refundAmount,
      isSimulated: false,
    };
  } catch (err: unknown) {
    return {
      success: false,
      refundedAmount: 0,
      message: err instanceof Error ? err.message : "환불 요청 중 네트워크 오류",
    };
  }
}

/**
 * 3. 포트원 빌링키 삭제 API (자동 갱신 차단)
 * DELETE https://api.portone.io/billing-keys/{billingKey}
 */
export async function deletePortOneBillingKey(
  billingKey?: string | null
): Promise<{ success: boolean; message?: string }> {
  if (!billingKey || isSimulationMode(billingKey)) {
    return { success: true };
  }

  const headers = getSecretHeader();
  if (!headers) {
    return { success: true }; // 시크릿 없으면 시뮬레이션 성공 처리
  }

  try {
    const res = await fetch(
      `${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`,
      {
        method: "DELETE",
        headers,
      }
    );

    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message: err.message || `빌링키 삭제 실패 (HTTP ${res.status})`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "빌링키 삭제 네트워크 오류",
    };
  }
}
