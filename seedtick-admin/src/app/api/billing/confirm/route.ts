import { NextResponse } from "next/server";
import { authenticateServerRequest, getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { verifyPortOnePayment } from "@/lib/subscription/portoneServer";
import { calculateSubscriptionExpiry } from "@/lib/subscription/subscriptionPolicy";
import { PlanType, Subscription, PaymentTransaction } from "@/lib/subscription/types";

interface ConfirmRequestBody {
  paymentId?: string;
  billingKey?: string;
  planType: PlanType;
  merchantUid?: string;
  payMethod?: string;
}

export async function POST(req: Request) {
  // 1. 유저 인증 검증
  const { user, error: authError } = await authenticateServerRequest(req);
  if (!user) {
    return NextResponse.json(
      { success: false, message: authError || "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const supabase = getServerSupabaseClient(token);

  try {
    const body = (await req.json()) as ConfirmRequestBody;
    const { paymentId, billingKey, planType, merchantUid, payMethod = "card" } = body;

    if (!planType || planType === "none") {
      return NextResponse.json(
        { success: false, message: "유효하지 않은 플랜입니다." },
        { status: 400 }
      );
    }

    const expectedAmount = planType === "monthly" ? 2900 : 29000;
    const effectivePaymentId = paymentId || `pay_sim_${Date.now()}`;
    const effectiveMerchantUid = merchantUid || `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 2. 포트원 결제 검증 (서버에서 실결제 여부 및 금액 위변조 확인)
    const verification = await verifyPortOnePayment(effectivePaymentId, expectedAmount);
    if (!verification.success || !verification.data) {
      return NextResponse.json(
        {
          success: false,
          message: verification.message || "포트원 결제 검증에 실패했습니다.",
        },
        { status: 400 }
      );
    }

    const verified = verification.data;
    const now = new Date();

    // 3. 기존 만료일 조회 및 신규 만료일 산출
    let currentPeriodEnd: Date | null = null;
    if (supabase) {
      const { data: currentSub } = await supabase
        .from("subscriptions")
        .select("current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      if (currentSub?.current_period_end) {
        currentPeriodEnd = new Date(currentSub.current_period_end);
      }
    }

    const newExpiry = calculateSubscriptionExpiry(currentPeriodEnd, planType, now);
    const newExpiryStr = newExpiry.toISOString();
    const nowStr = now.toISOString();

    // 4. DB에 안전하게 서버 권한으로 트랜잭션 기록
    const updatedSub: Subscription = {
      id: `sub_${user.id}`,
      userId: user.id,
      tier: "pro",
      planType,
      status: "active",
      currentPeriodStart: nowStr,
      currentPeriodEnd: newExpiryStr,
      billingKey: billingKey || null,
      canceledAt: null,
    };

    const newPayment: PaymentTransaction = {
      id: effectiveMerchantUid,
      paymentId: verified.paymentId,
      planType,
      amount: verified.amount,
      payMethod: verified.payMethod || payMethod,
      cardLast4: verified.cardLast4 || null,
      status: "paid",
      receiptUrl: verified.receiptUrl || null,
      paidAt: verified.paidAt || nowStr,
    };

    if (supabase) {
      // 4-1. subscriptions upsert
      const { error: subError } = await supabase.from("subscriptions").upsert({
        user_id: user.id,
        tier: "pro",
        plan_type: planType,
        status: "active",
        current_period_start: nowStr,
        current_period_end: newExpiryStr,
        billing_key: billingKey || null,
        canceled_at: null,
        updated_at: nowStr,
      });

      if (subError) {
        console.warn("[confirm API] subscriptions 저장 경고:", subError.message);
      }

      // 4-2. payment_transactions insert
      const { error: payError } = await supabase.from("payment_transactions").insert({
        user_id: user.id,
        merchant_uid: newPayment.id,
        imp_uid: newPayment.paymentId,
        amount: newPayment.amount,
        plan_type: planType,
        pay_method: newPayment.payMethod,
        card_last4: newPayment.cardLast4,
        receipt_url: newPayment.receiptUrl,
        status: "paid",
        paid_at: newPayment.paidAt,
      });

      if (payError) {
        console.warn("[confirm API] payment_transactions 기록 경고:", payError.message);
      }
    }

    return NextResponse.json({
      success: true,
      subscription: updatedSub,
      payment: newPayment,
      isSimulated: verified.isSimulated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "결제 승인 처리 중 서버 오류",
      },
      { status: 500 }
    );
  }
}
