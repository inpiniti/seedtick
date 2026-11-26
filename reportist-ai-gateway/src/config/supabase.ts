// supabase.ts - Supabase 원격 호출 실패 분류 공통 유틸
import { env } from './env.ts';

const AUTH_FAILURE_PATTERN =
  /invalid api key|invalid jwt|\bjwt\b|unauthorized|permission denied|forbidden|service role|insufficient service/i;

/** 잘못된/만료된 키처럼 재시도해도 해결되지 않는 인증 실패인지 판별한다. */
export function isSupabaseAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: unknown; status?: unknown; message?: unknown; hint?: unknown };
  for (const value of [err.status, err.code]) {
    const status = String(value ?? '');
    if (status === '401' || status === '403') return true;
  }
  const text = [err.message, err.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
  return AUTH_FAILURE_PATTERN.test(text);
}

export function hasSupabaseCredentials(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}
