import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/subscription/admin";

/**
 * 내 관리자 여부 조회 — 사이드바/섹션 노출 판정용 (UX 게이팅).
 * 진짜 인가는 각 /api/admin/* + analyzer가 다시 검증하므로 위조 불가.
 */
export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    // 비관리자는 200 + isAdmin:false로 반환 (클라는 로그인/권한 분기용으로만 사용)
    if (gate.status === 401 || gate.status === 403) {
      return NextResponse.json({ success: true, isAdmin: false });
    }
    return NextResponse.json(
      { success: false, isAdmin: false, message: gate.message },
      { status: gate.status }
    );
  }
  return NextResponse.json({ success: true, isAdmin: true });
}
