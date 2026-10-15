import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import {
  getServerAllowedFreeDate,
  isDateAllowedForAccess,
  resolveReportAccess,
} from "@/lib/subscription/reportAccess";

/**
 * 내재가치 히스토리 — fair_value는 민감정보이므로 권한 없는 일자 레코드는
 * 한 건도 반환하지 않습니다 (마스킹이 아니라 제외).
 */
export async function GET(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { success: false, message: "서버 리포트 조회 설정이 없습니다." },
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

  const access = await resolveReportAccess(req);

  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("ticker, d, datapack->valuation_consensus->fair_value_price")
      .order("d", { ascending: true });
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    const now = new Date();
    const allowedFreeDate =
      access.tier === "free" && !access.isTrialActive
        ? await getServerAllowedFreeDate(supabase, now)
        : undefined;
    const records: Array<{
      ticker: string;
      d: string;
      fair_value_price: number;
    }> = [];
    for (const row of (data as Array<Record<string, unknown>>) || []) {
      const d = row.d as string;
      // 권한 없는 일자(최근 30일 등)의 적정가는 목록에 포함조차 하지 않음
      if (!isDateAllowedForAccess(d, access, now, allowedFreeDate)) continue;
      const fv = (row as { fair_value_price?: unknown }).fair_value_price;
      if (typeof fv === "number" && Number.isFinite(fv) && fv > 0) {
        records.push({
          ticker: String(row.ticker).toUpperCase(),
          d,
          fair_value_price: fv,
        });
      }
    }
    return NextResponse.json({ success: true, records });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "히스토리 조회 실패",
      },
      { status: 500 }
    );
  }
}
