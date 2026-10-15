import { NextResponse } from "next/server";
import {
  authenticateServerRequest,
  getServerSupabaseClient,
} from "@/lib/subscription/supabaseServer";
import { PlanType, Subscription, PaymentTransaction } from "@/lib/subscription/types";

/**
 * 내 구독 상태 조회 API — 과금 관련 화면의 유일한 데이터 출처입니다.
 *
 * 프론트는 localStorage나 anon 직접 조회가 아니라 이 API만 신뢰합니다.
 * localStorage에 값을 넣어 PRO로 위조하는 우회가 불가능해집니다.
 */
export async function GET(req: Request) {
  const { user, error: authError } = await authenticateServerRequest(req);
  if (!user) {
    return NextResponse.json(
      { success: false, message: authError || "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[status API] SUPABASE_SERVICE_ROLE_KEY 미설정");
    return NextResponse.json(
      {
        success: false,
        message:
          "서버 구독 조회 설정이 되어 있지 않습니다. 관리자에게 문의해 주세요. (SUPABASE_SERVICE_ROLE_KEY)",
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
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: payRows } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("paid_at", { ascending: false });

    let subscription: Subscription | null = null;
    if (subRow) {
      let tier = (subRow.tier as "free" | "pro") ?? "free";
      let status = (subRow.status as Subscription["status"]) ?? "active";
      // 만료된 PRO는 free로 내려서 보여줌 (표시 정합성)
      if (
        tier === "pro" &&
        subRow.current_period_end &&
        new Date(subRow.current_period_end as string).getTime() < Date.now()
      ) {
        tier = "free";
        status = "expired";
      }
      subscription = {
        id: String(subRow.id ?? `sub_${user.id}`),
        userId: user.id,
        tier,
        planType: (subRow.plan_type as PlanType) ?? "none",
        status,
        currentPeriodStart: String(
          subRow.current_period_start ?? new Date().toISOString()
        ),
        currentPeriodEnd: (subRow.current_period_end as string | null) ?? null,
        billingKey: null, // 빌링키는 클라이언트에 노출하지 않음
        canceledAt: (subRow.canceled_at as string | null) ?? null,
      };
    }

    const payments: PaymentTransaction[] = (payRows ?? []).map((r) => ({
      id: String(r.merchant_uid ?? r.id),
      paymentId: (r.imp_uid as string | null) ?? null,
      planType: (r.plan_type as "monthly" | "yearly") ?? "monthly",
      amount: Number(r.amount ?? 0),
      payMethod: String(r.pay_method ?? "CARD"),
      cardLast4: (r.card_last4 as string | null) ?? null,
      status: (r.status as PaymentTransaction["status"]) ?? "paid",
      receiptUrl: (r.receipt_url as string | null) ?? null,
      paidAt: String(r.paid_at ?? new Date().toISOString()),
      refundedAmount: r.refunded_amount != null ? Number(r.refunded_amount) : null,
      refundedAt: (r.refunded_at as string | null) ?? null,
    }));

    return NextResponse.json({ success: true, subscription, payments });
  } catch (err: unknown) {
    console.error("[status API] 예외:", err);
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "구독 조회 중 서버 오류",
      },
      { status: 500 }
    );
  }
}
