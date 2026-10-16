import { NextResponse } from "next/server";
import {
  authenticateServerRequest,
  getServerSupabaseClient,
} from "@/lib/subscription/supabaseServer";
import {
  getBillingKeyInfo,
  deletePortOneBillingKey,
} from "@/lib/subscription/portoneServer";

interface ChangeCardRequestBody {
  billingKey?: string;
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

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as ChangeCardRequestBody;
    const { billingKey } = body;

    if (!billingKey || typeof billingKey !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "새로운 카드 등록 정보가 없습니다. 카드를 다시 등록해 주세요.",
        },
        { status: 400 }
      );
    }

    // 2. 유저의 현재 구독 조회 (월간 정기구독 유저인지 확인)
    const { data: dbSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!dbSub || dbSub.tier !== "pro" || dbSub.plan_type !== "monthly") {
      return NextResponse.json(
        {
          success: false,
          message: "월간 정기결제 이용 중인 경우에만 카드를 변경할 수 있어요.",
        },
        { status: 400 }
      );
    }

    // 3. 신규 빌링키 유효성 검증 및 카드 메타데이터 추출
    const keyInfo = await getBillingKeyInfo(billingKey);
    if (!keyInfo.success) {
      return NextResponse.json(
        {
          success: false,
          message: keyInfo.message || "카드 유효성 확인에 실패했어요.",
        },
        { status: 400 }
      );
    }

    const newCardName = keyInfo.cardName || null;
    const newCardLast4 = keyInfo.cardLast4 || null;
    const oldBillingKey = (dbSub.billing_key as string | null) ?? null;
    const nowStr = new Date().toISOString();

    // 4. subscriptions 테이블의 billing_key 및 카드 메타 갱신
    const updatePayload: Record<string, unknown> = {
      billing_key: billingKey,
      updated_at: nowStr,
    };
    if (newCardName) updatePayload.card_name = newCardName;
    if (newCardLast4) updatePayload.card_last4 = newCardLast4;

    let { error: updateError } = await supabase
      .from("subscriptions")
      .update(updatePayload)
      .eq("user_id", user.id);

    // 컬럼 미존재 시 fallback
    if (
      updateError &&
      (updateError.message.includes("card_") ||
        updateError.message.includes("column"))
    ) {
      delete updatePayload.card_name;
      delete updatePayload.card_last4;
      const retry = await supabase
        .from("subscriptions")
        .update(updatePayload)
        .eq("user_id", user.id);
      updateError = retry.error;
    }

    if (updateError) {
      console.error(
        "[change-card API] subscriptions 갱신 실패:",
        updateError.message
      );
      return NextResponse.json(
        {
          success: false,
          message:
            "카드 정보 변경을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
        },
        { status: 500 }
      );
    }

    // 5. 이전 빌링키가 있고 새 빌링키와 다르면 이전 빌링키 정리 (비동기 안전 처리)
    if (oldBillingKey && oldBillingKey !== billingKey) {
      deletePortOneBillingKey(oldBillingKey).catch((e) => {
        console.warn("[change-card API] 구 빌링키 정리 실패 (무시 가능):", e);
      });
    }

    return NextResponse.json({
      success: true,
      cardName: newCardName,
      cardLast4: newCardLast4,
    });
  } catch (err: unknown) {
    console.error("[change-card API] 예외:", err);
    return NextResponse.json(
      {
        success: false,
        message:
          err instanceof Error ? err.message : "카드 변경 처리 중 서버 오류",
      },
      { status: 500 }
    );
  }
}
