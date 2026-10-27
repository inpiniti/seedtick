import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";

/**
 * 마켓 브리핑 목록 조회 API (/api/admin/briefings)
 * 최근 발행된 일일 커뮤니티 & 24시간 뉴스 브리핑 목록을 반환합니다.
 */
export async function GET(req: Request) {
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "서버 DB 연결 설정이 없습니다." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || "30") || 30, 1), 100);
  const date = searchParams.get("date");

  try {
    let query = supabase
      .from("market_briefings")
      .select("*")
      .order("d", { ascending: false })
      .limit(limit);

    if (date) {
      query = query.eq("d", date);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, briefings: data || [] });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "브리핑 조회 실패",
      },
      { status: 500 }
    );
  }
}
