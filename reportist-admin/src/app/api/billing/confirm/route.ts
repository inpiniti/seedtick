import { NextResponse } from "next/server";
import {
  authenticateServerRequest,
  getServerSupabaseClient,
} from "@/lib/subscription/supabaseServer";
import {
  verifyPortOnePayment,
  getBillingKeyInfo,
  payWithBillingKey,
  isDevSimulationAllowed,
} from "@/lib/subscription/portoneServer";
import {
  calculateSubscriptionExpiry,
  getPlanAmount,
} from "@/lib/subscription/subscriptionPolicy";
import { PlanType, Subscription, PaymentTransaction } from "@/lib/subscription/types";

interface ConfirmRequestBody {
  paymentId?: string;
  billingKey?: string;
  planType: PlanType;
  payMethod?: string;
}

function randomSuffix(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 결제 확정 API — 서버가 모든 것을 검증하고 기록합니다.
 *
 * - 월간(정기): 클라이언트가 전달한 billingKey를 PortOne에서 검증한 뒤
 *   서버가 직접 첫 달을 청구합니다. 금액은 서버 상수 기준이라 위변조 불가.
 * - 연간(단건): 클라이언트가 전달한 paymentId를 PortOne에서 조회해
 *   상태(PAID) + 금액 + 본인 결제를 검증합니다.
 * - DB 기록(service_role)에 실패하면 성공을 반환하지 않습니다 (fail-closed).
 *   이전처럼 "성공처럼 보이고 새로고침하면 사라지는" 현상이 생기지 않습니다.
 */
export async function POST(req: Request) {
  // 1. 유저 인증 검증
  const { user, error: authError } = await authenticateServerRequest(req);
  if (!user) {
    return NextResponse.json(
      { success: false, message: authError || "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  // 2. 서버 DB 클라이언트 (service_role 필수 — 없으면 절대 PRO를 부여하지 않음)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!serviceRoleKey) {
    console.error("[confirm API] SUPABASE_SERVICE_ROLE_KEY 미설정");
    return NextResponse.json(
      {
        success: false,
        message:
          "서버 결제 저장 설정이 되어 있지 않습니다. 관리자에게 문의해 주세요. (SUPABASE_SERVICE_ROLE_KEY)",
      },
      { status: 500 }
    );
  }
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json()) as ConfirmRequestBody;
    const { paymentId, billingKey, planType, payMethod = "card" } = body;

    if (planType !== "monthly" && planType !== "yearly") {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 플랜입니다." },
        { status: 400 }
      );
    }
    if (payMethod !== "card" && payMethod !== "easypay") {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 결제 수단입니다." },
        { status: 400 }
      );
    }

    // 금액은 서버 상수가 유일한 기준 (클라이언트 금액은 받지 않음)
    const expectedAmount = getPlanAmount(planType);
    const now = new Date();
    const nowStr = now.toISOString();

    let verifiedPaymentId: string;
    let verifiedAmount: number;
    let verifiedPayMethod: string;
    let verifiedCardLast4: string | null;
    let verifiedReceiptUrl: string | null;
    let verifiedPaidAt: string;
    let effectiveBillingKey: string | null = null;
    let isSimulated = false;
    let merchantUidForDb = `order_${randomSuffix()}`;

    if (planType === "monthly") {
      // ---- 월간: 빌링키 검증 + 서버 직접 청구 ----
      if (!billingKey || typeof billingKey !== "string") {
        return NextResponse.json(
          { success: false, message: "카드 등록 정보가 없습니다. 카드를 다시 등록해 주세요." },
          { status: 400 }
        );
      }

      const keyCheck = await getBillingKeyInfo(billingKey);
      if (!keyCheck.success) {
        return NextResponse.json(
          { success: false, message: keyCheck.message || "카드 등록 확인에 실패했습니다." },
          { status: 400 }
        );
      }
      isSimulated = keyCheck.isSimulated === true;

      // paymentId / merchantUid는 서버가 생성 (클라이언트 값 무시 — 중복·예측 방지)
      const serverPaymentId = isSimulated
        ? `pay_sim_${randomSuffix()}`
        : `pay_${randomSuffix()}`;
      const serverMerchantUid = `order_${randomSuffix()}`;

      const charge = await payWithBillingKey({
        billingKey,
        paymentId: serverPaymentId,
        orderName: "Reportist Research Pro 멤버십 (월간 정기구독)",
        amount: expectedAmount,
        customerId: user.id,
        customerName: user.email?.split("@")[0] || "Reportist 회원",
        customerEmail: user.email,
        channelKey:
          process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_BILLING || undefined,
      });
      if (!charge.success || !charge.data) {
        return NextResponse.json(
          { success: false, message: charge.message || "카드 청구에 실패했습니다." },
          { status: 402 }
        );
      }

      verifiedPaymentId = charge.data.paymentId;
      verifiedAmount = charge.data.amount;
      verifiedPayMethod = charge.data.payMethod || "CARD";
      verifiedCardLast4 = charge.data.cardLast4 || null;
      verifiedReceiptUrl = charge.data.receiptUrl || null;
      verifiedPaidAt = charge.data.paidAt || nowStr;
      effectiveBillingKey = billingKey;

      // DB 기록용 merchantUid 보관 (서버 생성값 사용)
      merchantUidForDb = serverMerchantUid;
    } else {
      // ---- 연간: 단건 결제 검증 ----
      if (!paymentId || typeof paymentId !== "string") {
        return NextResponse.json(
          { success: false, message: "결제 정보가 없습니다. 다시 결제해 주세요." },
          { status: 400 }
        );
      }

      const verification = await verifyPortOnePayment(paymentId, expectedAmount, {
        userId: user.id,
        userEmail: user.email,
      });
      if (!verification.success || !verification.data) {
        return NextResponse.json(
          {
            success: false,
            message: verification.message || "포트원 결제 검증에 실패했습니다.",
          },
          { status: 400 }
        );
      }

      // 동일 결제 재사용(리플레이) 방지: 이미 기록된 imp_uid면 멱등 반환
      const { data: existing } = await supabase
        .from("payment_transactions")
        .select("id, user_id")
        .eq("imp_uid", verification.data.paymentId)
        .maybeSingle();
      if (existing) {
        if ((existing as { user_id: string }).user_id !== user.id) {
          return NextResponse.json(
            { success: false, message: "이미 사용된 결제입니다." },
            { status: 409 }
          );
        }
        const { data: currentSub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        const { data: payRow } = await supabase
          .from("payment_transactions")
          .select("*")
          .eq("imp_uid", verification.data.paymentId)
          .maybeSingle();
        return NextResponse.json({
          success: true,
          subscription: currentSub ? mapSubscription(currentSub, user.id) : null,
          payment: payRow ? mapPayment(payRow) : null,
          alreadyProcessed: true,
        });
      }

      verifiedPaymentId = verification.data.paymentId;
      verifiedAmount = verification.data.amount;
      verifiedPayMethod = verification.data.payMethod || payMethod;
      verifiedCardLast4 = verification.data.cardLast4 || null;
      verifiedReceiptUrl = verification.data.receiptUrl || null;
      verifiedPaidAt = verification.data.paidAt || nowStr;
      isSimulated = verification.data.isSimulated === true;
    }

    if (isSimulated && !isDevSimulationAllowed()) {
      // 방어적 이중 체크 — 위에서 이미 걸러지지만 절대 우회를 허용하지 않음
      return NextResponse.json(
        { success: false, message: "테스트 결제는 허용되지 않았습니다." },
        { status: 403 }
      );
    }

    // 3. 기존 만료일 조회 및 신규 만료일 산출
    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    const prevEnd = currentSub?.current_period_end
      ? new Date(currentSub.current_period_end as string)
      : null;

    const newExpiry = calculateSubscriptionExpiry(prevEnd, planType, now);
    const newExpiryStr = newExpiry.toISOString();

    // 4. DB 기록 — 결제 내역을 먼저 남기고(돈의 흔적 보존) 구독을 갱신
    const { error: payError } = await supabase.from("payment_transactions").insert({
      user_id: user.id,
      merchant_uid: merchantUidForDb,
      imp_uid: verifiedPaymentId,
      amount: verifiedAmount,
      plan_type: planType,
      pay_method: verifiedPayMethod,
      card_last4: verifiedCardLast4,
      receipt_url: verifiedReceiptUrl,
      status: "paid",
      paid_at: verifiedPaidAt,
    });

    if (payError) {
      console.error("[confirm API] payment_transactions 기록 실패:", payError.message);
      return NextResponse.json(
        {
          success: false,
          message: `결제는 승인됐으나 서버 기록에 실패했습니다. 고객센터로 문의해 주세요. (결제ID: ${verifiedPaymentId})`,
        },
        { status: 500 }
      );
    }

    const { error: subError } = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        tier: "pro",
        plan_type: planType,
        status: "active",
        current_period_start: nowStr,
        current_period_end: newExpiryStr,
        billing_key: effectiveBillingKey,
        canceled_at: null,
        updated_at: nowStr,
      },
      { onConflict: "user_id" }
    );

    if (subError) {
      console.error("[confirm API] subscriptions 저장 실패:", subError.message);
      return NextResponse.json(
        {
          success: false,
          message: `결제는 승인됐으나 구독 적용에 실패했습니다. 고객센터로 문의해 주세요. (결제ID: ${verifiedPaymentId})`,
        },
        { status: 500 }
      );
    }

    const updatedSub: Subscription = {
      id: `sub_${user.id}`,
      userId: user.id,
      tier: "pro",
      planType,
      status: "active",
      currentPeriodStart: nowStr,
      currentPeriodEnd: newExpiryStr,
      billingKey: null, // 빌링키는 클라이언트에 노출하지 않음
      canceledAt: null,
    };

    const newPayment: PaymentTransaction = {
      id: merchantUidForDb,
      paymentId: verifiedPaymentId,
      planType,
      amount: verifiedAmount,
      payMethod: verifiedPayMethod,
      cardLast4: verifiedCardLast4,
      status: "paid",
      receiptUrl: verifiedReceiptUrl,
      paidAt: verifiedPaidAt,
    };

    return NextResponse.json({
      success: true,
      subscription: updatedSub,
      payment: newPayment,
      isSimulated,
    });
  } catch (err: unknown) {
    console.error("[confirm API] 예외:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "결제 승인 처리 중 서버 오류",
      },
      { status: 500 }
    );
  }
}

function mapSubscription(
  row: Record<string, unknown>,
  userId: string
): Subscription {
  return {
    id: String(row.id ?? `sub_${userId}`),
    userId,
    tier: (row.tier as "free" | "pro") ?? "free",
    planType: (row.plan_type as PlanType) ?? "monthly",
    status: (row.status as Subscription["status"]) ?? "active",
    currentPeriodStart: String(row.current_period_start ?? new Date().toISOString()),
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    billingKey: null,
    canceledAt: (row.canceled_at as string | null) ?? null,
  };
}

function mapPayment(row: Record<string, unknown>): PaymentTransaction {
  return {
    id: String(row.merchant_uid ?? row.id),
    paymentId: (row.imp_uid as string | null) ?? null,
    planType: (row.plan_type as "monthly" | "yearly") ?? "monthly",
    amount: Number(row.amount ?? 0),
    payMethod: String(row.pay_method ?? "CARD"),
    cardLast4: (row.card_last4 as string | null) ?? null,
    status: (row.status as PaymentTransaction["status"]) ?? "paid",
    receiptUrl: (row.receipt_url as string | null) ?? null,
    paidAt: String(row.paid_at ?? new Date().toISOString()),
    refundedAmount: row.refunded_amount != null ? Number(row.refunded_amount) : null,
    refundedAt: (row.refunded_at as string | null) ?? null,
  };
}
