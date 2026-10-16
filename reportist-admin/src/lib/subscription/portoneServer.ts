/**
 * PortOne V2 서버 사이드 API 통신 모듈
 * 공식 V2 API: https://api.portone.io
 * 주의: 이 모듈은 API Route / 서버 환경에서만 실행되어야 하며 브라우저에 노출되지 않습니다.
 *
 * 보안 원칙:
 * - 모든 금액/플랜 검증은 서버 상수 기준으로 수행하고 클라이언트 값을 신뢰하지 않습니다.
 * - 시크릿이 없으면 실패로 닫습니다(fail-closed). 시뮬레이션 성공은
 *   ALLOW_DEV_SIMULATION=true + production이 아닐 때만 허용됩니다.
 */

const PORTONE_API_BASE = "https://api.portone.io";

export interface VerifiedPaymentInfo {
  paymentId: string;
  orderName: string;
  amount: number;
  status: "PAID" | "CANCELLED" | "PARTIAL_CANCELLED" | "FAILED" | "UNKNOWN";
  payMethod: string;
  cardName?: string | null;
  cardLast4?: string | null;
  receiptUrl?: string | null;
  paidAt: string;
  customerId?: string | null;
  customerEmail?: string | null;
  isSimulated?: boolean;
}

export interface BillingKeyInfoResult {
  success: boolean;
  message?: string;
  isSimulated?: boolean;
  cardName?: string | null;
  cardLast4?: string | null;
}

export interface CancelResult {
  success: boolean;
  refundedAmount: number;
  isSimulated?: boolean;
  message?: string;
}

function getApiSecret(): string | null {
  return process.env.PORTONE_API_SECRET || null;
}

/** 개발 시뮬레이션 허용 여부 (프로덕션에서는 항상 false) */
export function isDevSimulationAllowed(): boolean {
  return (
    process.env.ALLOW_DEV_SIMULATION === "true" &&
    process.env.NODE_ENV !== "production"
  );
}

function isSimulatedId(id?: string | null): boolean {
  if (!id) return false;
  return (
    id.includes("_test_") ||
    id.startsWith("pay_sim_") ||
    id.startsWith("pay_test_") ||
    id.startsWith("billing_sim_") ||
    id.startsWith("billing_test_")
  );
}

function secretHeaders(): HeadersInit | null {
  const secret = getApiSecret();
  if (!secret) return null;
  return {
    Authorization: `PortOne ${secret}`,
    "Content-Type": "application/json",
  };
}

function extractCustomer(payload: Record<string, unknown>): {
  id: string | null;
  email: string | null;
} {
  const customer = (payload.customer ?? payload.Customer ?? {}) as Record<
    string,
    unknown
  >;
  const id =
    (customer.id as string | undefined) ??
    (customer.customerId as string | undefined) ??
    (payload.customerId as string | undefined) ??
    null;
  const email =
    (customer.email as string | undefined) ??
    (payload.customerEmail as string | undefined) ??
    null;
  return { id: id ?? null, email: email ?? null };
}

/** PortOne 응답 payload에서 카드사명(발행/발급사) 및 끝 4자리 추출 */
function extractCardMeta(payload: Record<string, unknown>): {
  cardName: string | null;
  cardLast4: string | null;
} {
  const methodObj = (payload.paymentMethod ?? payload.method ?? {}) as Record<
    string,
    unknown
  >;
  const cardObj = (methodObj.card ?? {}) as Record<string, unknown>;
  const publisherObj = (cardObj.publisher ?? {}) as Record<string, unknown>;
  const issuerObj = (cardObj.issuer ?? {}) as Record<string, unknown>;

  const cardName =
    (publisherObj.name as string | undefined) ??
    (issuerObj.name as string | undefined) ??
    (cardObj.name as string | undefined) ??
    (cardObj.brand as string | undefined) ??
    null;

  const cardLast4 =
    (cardObj.last4Digits as string | undefined) ??
    (cardObj.last4 as string | undefined) ??
    null;

  return { cardName, cardLast4 };
}

function simulatedPayment(
  paymentId: string,
  expectedAmount: number
): VerifiedPaymentInfo {
  return {
    paymentId,
    orderName: "Reportist Research Pro 멤버십 (개발 시뮬레이션)",
    amount: expectedAmount,
    status: "PAID",
    payMethod: "CARD",
    cardName: "신한카드",
    cardLast4: "4242",
    receiptUrl: null,
    paidAt: new Date().toISOString(),
    customerId: null,
    customerEmail: null,
    isSimulated: true,
  };
}

/**
 * 1. 포트원 결제 단건 조회 및 실결제 검증
 * GET https://api.portone.io/payments/{paymentId}
 *
 * - 결제 상태가 PAID가 아니면 실패
 * - 실결제 금액이 expectedAmount와 다르면 실패 (위변조 방지)
 * - PortOne에 기록된 고객 정보가 있으면 요청 유저와 일치해야 함 (결제 가로채기 방지)
 */
export async function verifyPortOnePayment(
  paymentId: string,
  expectedAmount: number,
  opts?: { userId?: string; userEmail?: string }
): Promise<{ success: boolean; data?: VerifiedPaymentInfo; message?: string }> {
  if (!paymentId || typeof paymentId !== "string") {
    return { success: false, message: "결제 ID가 유효하지 않습니다." };
  }

  // 개발 시뮬레이션: 명시적 허용 + 시뮬레이션 ID일 때만
  if (isSimulatedId(paymentId)) {
    if (!isDevSimulationAllowed()) {
      return {
        success: false,
        message:
          "테스트 결제는 허용되지 않았습니다. 실결제 키와 서버 시크릿을 설정해 주세요.",
      };
    }
    return { success: true, data: simulatedPayment(paymentId, expectedAmount) };
  }

  const headers = secretHeaders();
  if (!headers) {
    return {
      success: false,
      message:
        "서버에 PORTONE_API_SECRET 환경변수가 설정되지 않았습니다. Vercel 환경변수에 실제 시크릿을 등록해 주세요.",
    };
  }

  try {
    const res = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET", headers }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg =
        (err as { message?: string }).message ||
        `포트원 결제 조회 실패 (HTTP ${res.status})`;
      return { success: false, message: msg };
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const status = String(payload.status ?? "").toUpperCase();
    const amountObj = (payload.amount ?? {}) as Record<string, unknown>;
    const actualAmount = Number(
      amountObj.total ?? payload.totalAmount ?? payload.amount ?? NaN
    );

    // 결제 상태 검증
    if (status !== "PAID") {
      return {
        success: false,
        message: `결제 상태가 완료(PAID)가 아닙니다: ${String(payload.status ?? "UNKNOWN")}`,
      };
    }

    // 결제 금액 위변조 검증
    if (!Number.isFinite(actualAmount) || actualAmount !== expectedAmount) {
      return {
        success: false,
        message: `결제 금액 불일치 위변조 감지 (예상: ${expectedAmount}원, 실결제: ${Number.isFinite(actualAmount) ? actualAmount : "확인불가"}원)`,
      };
    }

    // 남의 결제를 가져다 쓰는 것 방지: PortOne 고객 식별자가 있으면 본인 것이어야 함
    const { id: customerId, email: customerEmail } = extractCustomer(payload);
    if (
      opts?.userId &&
      customerId &&
      customerId !== opts.userId &&
      customerId !== opts.userEmail
    ) {
      return {
        success: false,
        message:
          "이 결제는 다른 계정의 결제입니다. 본인 계정으로 직접 결제한 내역만 승인됩니다.",
      };
    }
    if (
      opts?.userEmail &&
      customerEmail &&
      customerEmail.toLowerCase() !== opts.userEmail.toLowerCase()
    ) {
      return {
        success: false,
        message:
          "결제 계정 이메일이 로그인 계정과 다릅니다. 본인 계정으로 다시 결제해 주세요.",
      };
    }

    // 카드 번호 및 영수증 추출
    const { cardName, cardLast4 } = extractCardMeta(payload);
    const methodObj = (payload.paymentMethod ?? payload.method ?? {}) as Record<
      string,
      unknown
    >;

    const receiptUrl = (payload.receiptUrl as string | undefined) ?? null;

    return {
      success: true,
      data: {
        paymentId: (payload.id as string | undefined) || paymentId,
        orderName: (payload.orderName as string | undefined) || "Reportist Pro",
        amount: actualAmount,
        status: "PAID",
        payMethod:
          (methodObj.type as string | undefined) ||
          (payload.payMethod as string | undefined) ||
          "CARD",
        cardName,
        cardLast4,
        receiptUrl,
        paidAt:
          (payload.paidAt as string | undefined) || new Date().toISOString(),
        customerId,
        customerEmail,
        isSimulated: false,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "포트원 결제 검증 중 네트워크 오류",
    };
  }
}

/**
 * 2. 빌링키 유효성 조회 (월간 정기결제 첫 과금 전 검증용)
 * GET https://api.portone.io/billing-keys/{billingKey}
 */
export async function getBillingKeyInfo(
  billingKey: string
): Promise<BillingKeyInfoResult> {
  if (!billingKey || typeof billingKey !== "string") {
    return { success: false, message: "빌링키가 유효하지 않습니다." };
  }

  if (isSimulatedId(billingKey)) {
    if (!isDevSimulationAllowed()) {
      return {
        success: false,
        message: "테스트 빌링키는 허용되지 않았습니다.",
      };
    }
    return {
      success: true,
      isSimulated: true,
      cardName: "신한카드",
      cardLast4: "4242",
    };
  }

  const headers = secretHeaders();
  if (!headers) {
    return {
      success: false,
      message:
        "서버에 PORTONE_API_SECRET 환경변수가 설정되지 않았습니다. Vercel 환경변수에 실제 시크릿을 등록해 주세요.",
    };
  }

  try {
    const res = await fetch(
      `${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`,
      { method: "GET", headers }
    );
    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          message: "유효하지 않은 카드 등록(빌링키)입니다. 카드를 다시 등록해 주세요.",
        };
      }
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message:
          (err as { message?: string }).message ||
          `빌링키 조회 실패 (HTTP ${res.status})`,
      };
    }
    const payload = (await res.json()) as Record<string, unknown>;
    const status = String(payload.status ?? "").toUpperCase();
    if (status === "DELETED" || status === "DEACTIVATED") {
      return {
        success: false,
        message: "해지된 카드 등록입니다. 카드를 다시 등록해 주세요.",
      };
    }

    const { cardName, cardLast4 } = extractCardMeta(payload);
    return {
      success: true,
      cardName,
      cardLast4,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "빌링키 조회 중 네트워크 오류",
    };
  }
}

/**
 * 3. 빌링키로 서버에서 직접 첫 결제 청구 (월간 플랜)
 * POST https://api.portone.io/payments/{paymentId}/billing-key
 *
 * 클라이언트가 카드를 등록하면 발급되는 billingKey로 서버가 PortOne에
 * 직접 과금 요청하므로, 클라이언트가 금액을 속일 수 없습니다.
 */
export async function payWithBillingKey(input: {
  billingKey: string;
  paymentId: string;
  orderName: string;
  amount: number;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  channelKey?: string;
}): Promise<{ success: boolean; data?: VerifiedPaymentInfo; message?: string }> {
  const {
    billingKey,
    paymentId,
    orderName,
    amount,
    customerId,
    customerName,
    customerEmail,
    channelKey,
  } = input;

  if (isSimulatedId(billingKey)) {
    if (!isDevSimulationAllowed()) {
      return {
        success: false,
        message: "테스트 빌링키는 허용되지 않았습니다.",
      };
    }
    return { success: true, data: simulatedPayment(paymentId, amount) };
  }

  const headers = secretHeaders();
  if (!headers) {
    return {
      success: false,
      message:
        "서버에 PORTONE_API_SECRET 환경변수가 설정되지 않았습니다. Vercel 환경변수에 실제 시크릿을 등록해 주세요.",
    };
  }

  try {
    // 주의: PortOne V2에서 customer.name은 문자열이 아니라 객체({ full })입니다.
    // 문자열로 보내면 "Invalid value for: body ... expected '{'" 검증 에러가 납니다.
    const customer: Record<string, unknown> = {};
    if (customerId) customer.id = customerId;
    if (customerName) customer.name = { full: customerName };
    if (customerEmail) customer.email = customerEmail;

    const res = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/billing-key`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          billingKey,
          orderName,
          customer,
          amount: { total: amount },
          currency: "KRW",
          ...(channelKey ? { channelKey } : {}),
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message:
          (err as { message?: string }).message ||
          `빌링키 결제 청구 실패 (HTTP ${res.status})`,
      };
    }

    const payload = (await res.json()) as Record<string, unknown>;
    const status = String(payload.status ?? "PAID").toUpperCase();
    const amountObj = (payload.amount ?? {}) as Record<string, unknown>;
    const actualAmount = Number(amountObj.total ?? amount);

    if (status !== "PAID") {
      return {
        success: false,
        message: `카드 청구가 완료되지 않았습니다: ${String(payload.status ?? "UNKNOWN")}`,
      };
    }
    if (actualAmount !== amount) {
      return {
        success: false,
        message: `청구 금액 불일치 (예상: ${amount}원, 실청구: ${actualAmount}원)`,
      };
    }

    const { cardName, cardLast4 } = extractCardMeta(payload);
    const methodObj = (payload.paymentMethod ?? payload.method ?? {}) as Record<
      string,
      unknown
    >;

    return {
      success: true,
      data: {
        paymentId: (payload.id as string | undefined) || paymentId,
        orderName,
        amount,
        status: "PAID",
        payMethod: (methodObj.type as string | undefined) || "CARD",
        cardName,
        cardLast4,
        receiptUrl: (payload.receiptUrl as string | undefined) ?? null,
        paidAt:
          (payload.paidAt as string | undefined) || new Date().toISOString(),
        customerId: customerId ?? null,
        customerEmail: customerEmail ?? null,
        isSimulated: false,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "빌링키 결제 청구 중 네트워크 오류",
    };
  }
}

/**
 * 4. 포트원 결제 부분 취소 / 환불
 * POST https://api.portone.io/payments/{paymentId}/cancel
 */
export async function cancelPortOnePayment(input: {
  paymentId: string;
  refundAmount: number;
  reason: string;
}): Promise<CancelResult> {
  const { paymentId, refundAmount, reason } = input;

  // 시뮬레이션 결제는 명시적 허용 시에만 성공 처리
  if (isSimulatedId(paymentId)) {
    if (!isDevSimulationAllowed()) {
      return {
        success: false,
        refundedAmount: 0,
        message: "테스트 결제는 허용되지 않았습니다.",
      };
    }
    return { success: true, refundedAmount: refundAmount, isSimulated: true };
  }

  const headers = secretHeaders();
  if (!headers) {
    return {
      success: false,
      refundedAmount: 0,
      message:
        "서버에 PORTONE_API_SECRET이 설정되지 않아 환불을 진행할 수 없습니다. 고객센터로 문의해 주세요.",
    };
  }

  try {
    const res = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ amount: refundAmount, reason }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        refundedAmount: 0,
        message:
          (err as { message?: string }).message ||
          `포트원 결제 취소 요청 실패 (HTTP ${res.status})`,
      };
    }

    return { success: true, refundedAmount: refundAmount, isSimulated: false };
  } catch (err: unknown) {
    return {
      success: false,
      refundedAmount: 0,
      message: err instanceof Error ? err.message : "환불 요청 중 네트워크 오류",
    };
  }
}

/**
 * 5. 포트원 빌링키 삭제 (자동 갱신 차단)
 * DELETE https://api.portone.io/billing-keys/{billingKey}
 */
export async function deletePortOneBillingKey(
  billingKey?: string | null
): Promise<{ success: boolean; message?: string }> {
  if (!billingKey) return { success: true };
  if (isSimulatedId(billingKey)) return { success: true };

  const headers = secretHeaders();
  if (!headers) {
    return {
      success: false,
      message:
        "서버에 PORTONE_API_SECRET이 설정되지 않아 자동결제 해지를 진행할 수 없습니다. 고객센터로 문의해 주세요.",
    };
  }

  try {
    const res = await fetch(
      `${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`,
      { method: "DELETE", headers }
    );

    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message:
          (err as { message?: string }).message ||
          `빌링키 삭제 실패 (HTTP ${res.status})`,
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "빌링키 삭제 네트워크 오류",
    };
  }
}
