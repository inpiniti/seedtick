import { NextResponse } from "next/server";
import {
  authenticateServerRequest,
  getServerSupabaseClient,
} from "@/lib/subscription/supabaseServer";
import {
  cancelPortOnePayment,
  deletePortOneBillingKey,
} from "@/lib/subscription/portoneServer";
import {
  calculateProratedRefund,
  CancellationDecision,
} from "@/lib/subscription/subscriptionPolicy";
import { PlanType } from "@/lib/subscription/types";

/**
 * 구독 해지 API — 서버가 DB를 기준으로 판단하고 처리합니다.
 *
 * 보안: 클라이언트가 보낸 paymentId/billingKey를 신뢰하지 않습니다.
 * DB에 기록된 해당 유저의 구독 + 최근 결제 내역만 사용하고,
 * 환불 금액도 서버가 일할 계산으로 산출합니다.
 */
export async function POST(req: Request) {
  // 1. 유저 인증
  const { user, error: authError } = await authenticateServerRequest(req);
  if (!user) {
    return NextResponse.json(
      { success: false, message: authError || "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[cancel API] SUPABASE_SERVICE_ROLE_KEY 미설정");
    return NextResponse.json(
      {
        success: false,
        message:
          "서버 해지 처리 설정이 되어 있지 않습니다. 관리자에게 문의해 주세요. (SUPABASE_SERVICE_ROLE_KEY)",
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
    // 2. 서버 DB에서 해당 유저의 구독 및 최근 결제 내역을 직접 조회 (유일한 기준)
    const { data: dbSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!dbSub || dbSub.tier !== "pro") {
      return NextResponse.json(
        { success: false, message: "해지할 PRO 구독이 없어요." },
        { status: 400 }
      );
    }

    const { data: latestPayment } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const paidAt = latestPayment?.paid_at ?? null;
    const amount = Number(latestPayment?.amount ?? 0);
    const planType = (latestPayment?.plan_type ?? dbSub.plan_type ?? "monthly") as PlanType;
    const paymentId = (latestPayment?.imp_uid as string | null) ?? null;
    const billingKey = (dbSub.billing_key as string | null) ?? null;

    // 3. 서버 사이드 일할 계산 (7일 이내 잔여액 부분 환불)
    const now = new Date();
    const decision: CancellationDecision = calculateProratedRefund({
      amount,
      planType,
      paidAt,
      now,
    });

    const nowStr = now.toISOString();

    // 4-A. 7일 이내 일할 계산 환불인 경우
    if (decision.mode === "refund") {
      if (!latestPayment || !paymentId) {
        return NextResponse.json(
          {
            success: false,
            message: "환불할 결제 내역이 없어요. 고객센터로 문의해 주세요.",
          },
          { status: 400 }
        );
      }
      if (decision.refundAmount <= 0) {
        return NextResponse.json(
          { success: false, message: "환불 가능 금액이 없어요." },
          { status: 400 }
        );
      }

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

      // 빌링키가 있었다면 함께 해지 (실패 시 DB를 건드리지 않고 에러 반환)
      if (billingKey) {
        const delRes = await deletePortOneBillingKey(billingKey);
        if (!delRes.success) {
          return NextResponse.json(
            {
              success: false,
              message:
                delRes.message ||
                "환불은 접수됐으나 자동결제 해지에 실패했어요. 고객센터로 문의해 주세요.",
            },
            { status: 502 }
          );
        }
      }

      // DB 갱신: 결제 내역 부분/전액 환불 상태 기록 + 구독 즉시 만료
      const isFullRefund = decision.refundAmount >= amount;
      const { error: payUpdateError } = await supabase
        .from("payment_transactions")
        .update({
          status: isFullRefund ? "refunded" : "partial_refunded",
          refunded_amount: decision.refundAmount,
          refunded_at: nowStr,
        })
        .eq("id", latestPayment.id);

      if (payUpdateError) {
        console.error("[cancel API] 결제 상태 갱신 실패:", payUpdateError.message);
        return NextResponse.json(
          {
            success: false,
            message:
              "환불은 접수됐으나 서버 기록에 실패했어요. 고객센터로 문의해 주세요.",
          },
          { status: 500 }
        );
      }

      const { error: subUpdateError } = await supabase
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

      if (subUpdateError) {
        console.error("[cancel API] 구독 갱신 실패:", subUpdateError.message);
        return NextResponse.json(
          {
            success: false,
            message:
              "환불은 접수됐으나 구독 상태 갱신에 실패했어요. 고객센터로 문의해 주세요.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        decision,
        message: decision.reason,
      });
    }

    // 4-B. 7일 초과 (자동갱신만 해지, 만료일까지 유지)
    if (billingKey) {
      const delRes = await deletePortOneBillingKey(billingKey);
      if (!delRes.success) {
        return NextResponse.json(
          {
            success: false,
            message:
              delRes.message ||
              "자동결제 해지에 실패했어요. 고객센터로 문의해 주세요.",
          },
          { status: 502 }
        );
      }
    }

    const { error: cancelError } = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        billing_key: null,
        canceled_at: nowStr,
        updated_at: nowStr,
      })
      .eq("user_id", user.id);

    if (cancelError) {
      console.error("[cancel API] 해지 상태 갱신 실패:", cancelError.message);
      return NextResponse.json(
        { success: false, message: "해지 처리에 실패했어요. 잠시 후 다시 시도해 주세요." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      decision,
      message: "다음 정기 결제가 해지되었습니다. 남은 기간까지 Pro 서비스를 이용하실 수 있습니다.",
    });
  } catch (err: unknown) {
    console.error("[cancel API] 예외:", err);
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error ? err.message : "구독 해지 처리 중 서버 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
