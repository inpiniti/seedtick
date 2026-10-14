import { supabase } from "@/lib/supabase";

export type AuthProviderType = "kakao" | "google" | "email";

/**
 * 카카오 소셜 로그인 요청
 */
export async function signInWithKakao(redirectTo?: string) {
  if (!supabase) {
    throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");
  }
  const redirectUrl =
    redirectTo || (typeof window !== "undefined" ? window.location.origin : "");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * 구글 소셜 로그인 요청
 */
export async function signInWithGoogle(redirectTo?: string) {
  if (!supabase) {
    throw new Error("Supabase 클라이언트가 초기화되지 않았습니다.");
  }
  const redirectUrl =
    redirectTo || (typeof window !== "undefined" ? window.location.origin : "");

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
  const redirectUrl =
    redirectTo || (typeof window !== "undefined" ? window.location.origin : "");

  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) throw error;
  return data;
}

/**
 * 로그아웃
 */
export async function signOutUser() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.warn("Sign out error:", error.message);
}
