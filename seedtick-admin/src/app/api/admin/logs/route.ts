import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/subscription/admin";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";

/**
 * 감사 로그 게이트웨이 — 관리자 전용.
 * error_logs 직접 SELECT가 RLS로 차단된 이후 유일한 진입점입니다.
 * - 비로그인 → 401, 비관리자 → 403
 */
export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, message: gate.message },
      { status: gate.status }
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
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || "60") || 60, 1), 200);
  const level = searchParams.get("level");

  try {
    let query = supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (level && level !== "ALL") {
      query = query.eq("level", level);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, logs: data || [] });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "감사 로그 조회 실패",
      },
      { status: 500 }
    );
  }
}
