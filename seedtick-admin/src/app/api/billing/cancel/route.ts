import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * 구독 해지 서버 엔드포인트
 * - mode = "refund": 포트원 결제 취소 API 호출 (POST /payments/{paymentId}/cancel)
 * - mode = "end_of_period": 자동갱신 중단을 위해 빌링키 삭제 (DELETE /billing-keys/{billingKey})
 *
 * 포트원 API Secret(PORTONE_API_SECRET)은 서버에서만 사용합니다.
 * Secret이 없거나 테스트 결제 ID인 경우 시뮬레이션으로 응답합니다.
 */

const PORTONE_API = "https://api.portone.io";

interface CancelBody {
  mode: "refund" | "end_of_period";
  paymentId?: string | null;
  billingKey?: string | null;
  refundAmount?: number;
}

async function verifyUser(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return null;
  const client = createClient(url, anon);
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

function isTestId(id?: string | null) {
  return !id || id.includes("_test_");
}

export async function POST(req: Request) {
  const user = await verifyUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: "로그인이 필요해요." }, { status: 401 });
  }

  const body = (await req.json()) as CancelBody;
  const secret = process.env.PORTONE_API_SECRET;
  const headers = {
    Authorization: `PortOne ${secret}`,
    "Content-Type": "application/json",
  };

  try {
    if (body.mode === "refund") {
      if (!secret || isTestId(body.paymentId)) {
        return NextResponse.json({ success: true, simulated: true });
      }
      const res = await fetch(
        `${PORTONE_API}/payments/${encodeURIComponent(body.paymentId!)}/cancel`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            amount: body.refundAmount,
            reason: "청약철회 기간 내 구독 해지",
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { success: false, message: err.message || "환불 처리에 실패했어요." },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true });
    }

    // end_of_period: 빌링키 삭제로 다음 회차 자동결제 차단
    if (!body.billingKey || !secret || isTestId(body.billingKey)) {
      return NextResponse.json({ success: true, simulated: true });
    }
    const res = await fetch(
      `${PORTONE_API}/billing-keys/${encodeURIComponent(body.billingKey)}`,
      { method: "DELETE", headers }
    );
    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, message: err.message || "자동결제 해지에 실패했어요." },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : "해지 처리 중 오류가 발생했어요." },
      { status: 500 }
    );
  }
}
