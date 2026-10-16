import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { verifyPortOnePayment } from "@/lib/subscription/portoneServer";
import {
  calculateSubscriptionExpiry,
  PLAN_AMOUNTS,
} from "@/lib/subscription/subscriptionPolicy";
import { PlanType } from "@/lib/subscription/types";

/**
 * PortOne 웹훅 수신 API (정기결제 갱신 등 서버 통지 정합용)
 * POST /api/billing/webhook
 *
 * 보안: 요청 본문은 절대 신뢰하지 않고, 본문에서 paymentId만 꺼내
 * PortOne 서버에 직접 재조회한 결과로만 판단합니다.
 * PortOne 관리자 콘솔 > 웹훅 설정에서 이 URL을 등록해 주세요.
 */
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[webhook API] SUPABASE_SERVICE_ROLE_KEY 미설정");
    return NextResponse.json(
      { success: false, message: "서버 설정이 없습니다." },
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
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data = (body.data ?? body) as Record<string, unknown>;
    const paymentId =
      (data.paymentId as string | undefined) ??
      (data.payment_id as string | undefined) ??
      (data.imp_uid as string | undefined) ??
      (body.paymentId as string | undefined) ??
      null;

    if (!paymentId) {
      // 결제 식별자가 없는 통지는 무시 (200으로 응답해 재시도 폭증 방지)
      return NextResponse.json({ success: true, ignored: true });
    }

    // PortOne에 직접 재조회 (유일한 기준). 금액을 모르므로
    // 허용 금액 후보(월간/연간)로 각각 조회해 일치하는 쪽을 채택합니다.
    let verified: Awaited<ReturnType<typeof verifyPortOnePayment>> | null = null;
    for (const candidate of [PLAN_AMOUNTS.monthly, PLAN_AMOUNTS.yearly]) {
      const r = await verifyPortOnePayment(paymentId, candidate);
      if (r.success && r.data) {
        verified = r;
        break;
      }
    }
    if (!verified?.data) {
      return NextResponse.json({ success: true, ignored: true });
    }
    const info = verified.data;
    const planType: PlanType =
      info.amount === PLAN_AMOUNTS.yearly ? "yearly" : "monthly";

    // 이미 기록된 결제는 무시 (멱등)
    const { data: existing } = await supabase
      .from("payment_transactions")
      .select("id")
      .eq("imp_uid", info.paymentId)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    // 유저 특정: 고객 ID 우선, 없으면 이메일로 프로필 조회
    let userId: string | null = null;
    if (info.customerId) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", info.customerId)
        .maybeSingle();
      if (profile) userId = profile.id as string;
    }
    if (!userId && info.customerEmail) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", info.customerEmail)
        .maybeSingle();
      if (profile) userId = profile.id as string;
    }
    if (!userId) {
      console.warn("[webhook API] 유저를 특정할 수 없는 결제:", info.paymentId);
      return NextResponse.json({ success: true, ignored: true });
    }

    const now = new Date();
    const nowStr = now.toISOString();
    const { data: currentSub } = await supabase
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    const prevEnd = currentSub?.current_period_end
      ? new Date(currentSub.current_period_end as string)
      : null;
    const newExpiry = calculateSubscriptionExpiry(prevEnd, planType, now);

    const payPayload: Record<string, unknown> = {
      user_id: userId,
      merchant_uid: `order_webhook_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      imp_uid: info.paymentId,
      amount: info.amount,
      plan_type: planType,
      pay_method: info.payMethod,
      card_last4: info.cardLast4,
      receipt_url: info.receiptUrl,
      status: "paid",
      paid_at: info.paidAt || nowStr,
    };
    if (info.cardName) payPayload.card_name = info.cardName;

    let { error: payErr } = await supabase.from("payment_transactions").insert(payPayload);
    if (payErr && (payErr.message.includes("card_name") || payErr.message.includes("column"))) {
      delete payPayload.card_name;
      await supabase.from("payment_transactions").insert(payPayload);
    }

    const subPayload: Record<string, unknown> = {
      user_id: userId,
      tier: "pro",
      plan_type: planType,
      status: "active",
      current_period_start: nowStr,
      current_period_end: newExpiry.toISOString(),
      canceled_at: null,
      updated_at: nowStr,
    };
    if (info.cardName) subPayload.card_name = info.cardName;
    if (info.cardLast4) subPayload.card_last4 = info.cardLast4;

    let { error: subErr } = await supabase
      .from("subscriptions")
      .upsert(subPayload, { onConflict: "user_id" });

    if (subErr && (subErr.message.includes("card_") || subErr.message.includes("column"))) {
      delete subPayload.card_name;
      delete subPayload.card_last4;
      await supabase.from("subscriptions").upsert(subPayload, { onConflict: "user_id" });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[webhook API] 예외:", err);
    // 웹훅은 500을 남발하면 PortOne이 재시도하므로, 처리 불가 건은 200 ignored로 흡수
    return NextResponse.json({ success: true, ignored: true });
  }
}
