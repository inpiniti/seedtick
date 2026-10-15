import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

/**
 * 서버 API Route 전용 Supabase 인증 및 DB 클라이언트 헬퍼
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * 요청 Authorization 헤더로부터 유저 세션을 검증합니다.
 */
export async function authenticateServerRequest(
  req: Request
): Promise<{ user: User | null; error?: string }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { user: null, error: "Supabase 설정이 없습니다." };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "Authorization Bearer 토큰이 없습니다." };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { user: null, error: "유효하지 않은 토큰입니다." };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message || "유저 인증 실패" };
  }

  return { user };
}

/**
 * 서버 전용 Supabase DB 클라이언트 생성
 * service_role_key가 있으면 관리자 권한 클라이언트를 반환하고,
 * 없으면 anon_key 기반 클라이언트를 반환합니다.
 */
export function getServerSupabaseClient(userToken?: string): SupabaseClient | null {
  if (!supabaseUrl) return null;

  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  if (userToken && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      },
      auth: { persistSession: false },
    });
  }

  if (supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  return null;
}
