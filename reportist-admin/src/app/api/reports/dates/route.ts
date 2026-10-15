import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";

/** 분석일자 목록 — 일자 자체는 민감정보가 아니므로 비로그인도 조회 가능 */
export async function GET() {
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
  try {
    const { data, error } = await supabase
      .from("guru_reports")
      .select("d")
      .order("d", { ascending: false });
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }
    const dates = Array.from(
      new Set(((data as Array<{ d: string }>) || []).map((r) => r.d))
    );
    return NextResponse.json({ success: true, dates });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "일자 조회 실패",
      },
      { status: 500 }
    );
  }
}
