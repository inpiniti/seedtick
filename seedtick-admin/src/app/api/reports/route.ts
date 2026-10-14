import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import {
  isDateAllowedForAccess,
  maskReportRow,
  resolveReportAccess,
} from "@/lib/subscription/reportAccess";
import type { GuruReportRow } from "@/types/api";

/**
 * 리포트 목록 게이트웨이 — guru_reports 직접 조회 금지 이후 유일한 진입점.
 * 권한 없는 일자 행은 민감 컬럼을 제거한 티저(현재가만)까지만 반환합니다.
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

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") || "200") || 200, 1),
    500
  );

  const access = await resolveReportAccess(req);

  try {
    let query = supabase
      .from("guru_reports")
      .select("*")
      .order("d", { ascending: false });

    if (date && date !== "ALL") {
      query = query.eq("d", date).order("overall_score", { ascending: true });
    }
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    const now = new Date();
    const reports = ((data as GuruReportRow[]) || []).map((row) =>
      maskReportRow(row, isDateAllowedForAccess(row.d, access, now))
    );

    return NextResponse.json({ success: true, reports });
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
