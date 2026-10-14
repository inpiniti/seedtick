import {
  authenticateServerRequest,
  getServerSupabaseClient,
} from "@/lib/subscription/supabaseServer";

/**
 * 관리자 전용 API 공용 가드.
 * - 토큰 없음/무효 → 401
 * - user_profiles.is_admin != true → 403 (DB가 단일 진실)
 * - service_role 미설정 → 500 (fail-closed)
 */
export async function requireAdmin(req: Request): Promise<
  | { ok: true; userId: string; email?: string }
  | { ok: false; status: 401 | 403 | 500; message: string }
> {
  const { user, error: authError } = await authenticateServerRequest(req);
  if (!user) {
    return { ok: false, status: 401, message: authError || "로그인이 필요합니다." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[admin guard] SUPABASE_SERVICE_ROLE_KEY 미설정");
    return {
      ok: false,
      status: 500,
      message: "서버 관리자 조회 설정이 되어 있지 않습니다.",
    };
  }
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return { ok: false, status: 500, message: "서버 DB 연결 설정이 없습니다." };
  }

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[admin guard] is_admin 조회 실패:", error.message);
      return { ok: false, status: 500, message: "관리자 확인 중 오류가 발생했습니다." };
    }
    if (!data || (data as { is_admin?: boolean }).is_admin !== true) {
      return { ok: false, status: 403, message: "관리자 권한이 필요합니다." };
    }
    return { ok: true, userId: user.id, email: user.email };
  } catch (err) {
    console.error("[admin guard] 예외:", err);
    return { ok: false, status: 500, message: "관리자 확인 중 오류가 발생했습니다." };
  }
}
