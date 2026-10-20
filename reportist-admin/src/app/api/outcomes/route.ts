import { NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { requireAdmin } from "@/lib/subscription/admin";
import { getOutcomesOverview, buildEmptyOverview } from "@/lib/server/outcomesData";

const ANALYZER_URL =
  process.env.NEXT_PUBLIC_ANALYZER_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

/**
 * 성과 추적 데이터 (공개 정보).
 * 집계 로직은 /outcomes 페이지(SSR)와 반드시 같은 함수를 사용한다.
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
  const horizonParam = searchParams.get("horizon");
  const horizonFilter =
    horizonParam && horizonParam !== "all" ? Number(horizonParam) : null;
  const limitParam = Number(searchParams.get("limit") || "100");

  const { overview, tableMissing } = await getOutcomesOverview(
    horizonFilter,
    limitParam
  );

  if (tableMissing) {
    return NextResponse.json({
      success: true,
      data: buildEmptyOverview(),
      message: "성과 추적 테이블이 아직 준비되지 않았어요.",
    });
  }

  return NextResponse.json({ success: true, data: overview });
}

/** 성과 추적 배치 수동 실행 (관리자 전용) */
export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, message: gate.message },
      { status: gate.status }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = `${ANALYZER_URL}/api/scheduler/outcomes`;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success) {
      return NextResponse.json(
        {
          success: false,
          message: json?.message || `분석기 서버 오류 (${res.status})`,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: json.message || "성과 추적 배치를 성공적으로 실행했어요.",
      evaluated: json.evaluated,
      duration_sec: json.duration_sec,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "배치 실행 중 오류가 발생했어요.",
      },
      { status: 500 }
    );
  }
}
