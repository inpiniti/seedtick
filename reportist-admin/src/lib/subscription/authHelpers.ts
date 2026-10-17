import { supabase } from "@/lib/supabase";

/**
 * OAuth/매직링크 완료 후 돌아올 canonical origin.
 * - 운영에서는 NEXT_PUBLIC_SITE_URL (예: https://reportist.kr) 사용
 * - 로컬 개발에서는 window.location.origin (http://localhost:3000) 사용
 * 이렇게 하지 않고 window.location.origin만 쓰면,
 * Supabase Site URL 설정에 따라 운영에서도 localhost로 튕긴다.
 */
function getRedirectOrigin(): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  if (siteUrl) return siteUrl;
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return "";
}

export type AuthProviderType = "google" | "email";

/**
 * 구글 소셜 로그인 요청
 */
export async function signInWithGoogle(redirectTo?: string) {
  if (!supabase) {
    throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");
  }
  const redirectUrl = redirectTo || getRedirectOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * 이메일 매직링크(OTP) 로그인 요청
 */
export async function signInWithMagicLink(email: string, redirectTo?: string) {
  if (!supabase) {
    throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");
  }
  const redirectUrl = redirectTo || getRedirectOrigin();

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) throw error;
  return data;
}

import { clearAllUserCache } from "@/lib/queryClient";

/**
 * 로그아웃 (스토리지 및 리포트 캐시 전면 정리)
 */
export async function signOutUser() {
  clearAllUserCache();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.warn("Sign out error:", error.message);
}
