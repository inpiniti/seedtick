import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import {
  getServerAllowedFreeDate,
  isDateAllowedForAccess,
  maskReportRow,
  resolveReportAccess,
} from "@/lib/subscription/reportAccess";
import type { GuruReportRow } from "@/types/api";

/** 단일 리포트 게이트웨이 — 권한 없으면 티저(현재가만) 반환, 원문은 절대 미포함 */
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

  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") || "").trim();
  const ticker = (searchParams.get("ticker") || "").trim().toUpperCase();
  if (!date || !ticker) {
    return NextResponse.json(
      { success: false, message: "date, ticker 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const access = await resolveReportAccess(req);

  try {
    const reportId = `${date}_${ticker}`;
    const { data, error } = await supabase
      .from("guru_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    let row = (data as GuruReportRow | null) || null;
    if (error || !row) {
      const fallback = await supabase
        .from("guru_reports")
        .select("*")
        .eq("d", date)
        .eq("ticker", ticker)
        .limit(1)
        .maybeSingle();
      row = (fallback.data as GuruReportRow | null) || null;
    }
    if (!row) {
      return NextResponse.json(
        { success: false, message: "리포트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const now = new Date();
    const allowedFreeDate =
      access.tier === "free" && !access.isTrialActive
        ? await getServerAllowedFreeDate(supabase, now)
        : undefined;
    const allowed = isDateAllowedForAccess(row.d, access, now, allowedFreeDate);
    return NextResponse.json({
      success: true,
      report: maskReportRow(row, allowed),
      restricted: !allowed,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "리포트 조회 실패",
      },
      { status: 500 }
    );
  }
}
