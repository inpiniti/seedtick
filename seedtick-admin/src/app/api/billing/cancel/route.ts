import { NextResponse } from "next/server";
import { authenticateServerRequest, getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { cancelPortOnePayment, deletePortOneBillingKey } from "@/lib/subscription/portoneServer";
import { calculateProratedRefund, CancellationDecision } from "@/lib/subscription/subscriptionPolicy";
import { PlanType } from "@/lib/subscription/types";

interface CancelRequestBody {
  paymentId?: string | null;
  billingKey?: string | null;
  planType?: PlanType;
}

export async function POST(req: Request) {
  // 1. 유저 인증
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
    const body = (await req.json().catch(() => ({}))) as CancelRequestBody;

    // 2. 서버 DB에서 해당 유저의 활성 구독 및 최근 결제 내역을 직접 조회
    let dbSub = null;
    let latestPayment = null;

    if (supabase) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      dbSub = sub;

      const { data: pay } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      latestPayment = pay;
    }

    const paidAt = latestPayment?.paidAt || latestPayment?.paid_at || null;
    const amount = Number(latestPayment?.amount ?? (body.planType === "yearly" ? 29000 : 2900));
    const planType: PlanType = (latestPayment?.plan_type || dbSub?.plan_type || body.planType || "monthly") as PlanType;
    const paymentId = latestPayment?.imp_uid || latestPayment?.merchant_uid || body.paymentId || null;
    const billingKey = dbSub?.billing_key || body.billingKey || null;

    // 3. 서버 사이드 일할 계산 수행 (하루라도 사용 시 1일분 공제, 7일 이내 잔여액 부분 환불)
    const now = new Date();
    const decision: CancellationDecision = calculateProratedRefund({
      amount,
      planType,
      paidAt,
      now,
    });

    // 4-A. 7일 이내 일할 계산 환불인 경우
    if (decision.mode === "refund" && decision.refundAmount > 0 && paymentId) {
      const cancelRes = await cancelPortOnePayment({
        paymentId,
        refundAmount: decision.refundAmount,
        reason: decision.reason,
      });

      if (!cancelRes.success) {
        return NextResponse.json(
          {
            success: false,
            message: cancelRes.message || "포트원 결제 환불 요청에 실패했습니다.",
          },
          { status: 502 }
        );
      }

      // 빌링키가 있었다면 함께 해지
      if (billingKey) {
        await deletePortOneBillingKey(billingKey);
      }

      const nowStr = now.toISOString();

      // DB 갱신: 결제 내역 부분/전액 환불 상태 기록
      if (supabase) {
        if (latestPayment) {
          const isFullRefund = decision.refundAmount >= amount;
          await supabase
            .from("payment_transactions")
            .update({
              status: isFullRefund ? "refunded" : "partial_refunded",
              refunded_amount: decision.refundAmount,
              refunded_at: nowStr,
            })
            .eq("id", latestPayment.id);
        }

        // 구독 즉시 만료 및 Free 전환
        await supabase
          .from("subscriptions")
          .update({
            tier: "free",
            status: "expired",
            billing_key: null,
            canceled_at: nowStr,
            current_period_end: nowStr,
            updated_at: nowStr,
          })
          .eq("user_id", user.id);
      }

      return NextResponse.json({
        success: true,
        decision,
        message: decision.reason,
      });
    }

    // 4-B. 7일 초과 (자동갱신만 해지, 만료일까지 유지)
    if (billingKey) {
      await deletePortOneBillingKey(billingKey);
    }

    const nowStr = now.toISOString();
    if (supabase) {
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          billing_key: null,
          canceled_at: nowStr,
          updated_at: nowStr,
        })
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      decision,
      message: "다음 정기 결제가 해지되었습니다. 남은 기간까지 Pro 서비스를 이용하실 수 있습니다.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "구독 해지 처리 중 서버 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
