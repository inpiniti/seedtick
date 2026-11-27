// QuotaManager.ts - Supabase 연동 일일 소진 키 관리

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { env } from '../../config/env.ts';
import { hasSupabaseCredentials, isSupabaseAuthError } from '../../config/supabase.ts';
import type { LLMProvider } from '../types.ts';
import { fallbackResetAt, parseResetAt } from './ResetAtParser.ts';

export class QuotaManager {
  private supabase: SupabaseClient | null = null;
  private exhaustedMap = new Map<string, number>();
  private remoteDisabled = false;
  private remoteWarningNotified = false;

  private buildKey(provider: string, model: string, apiKeyHash: string): string {
    return `${provider}:${model}:${apiKeyHash}`;
  }

  private getApiKeyHash(apiKey: string): string {
    return apiKey.slice(-8);
  }

  private getSupabase(): SupabaseClient | null {
    if (this.remoteDisabled || !hasSupabaseCredentials()) return null;
    if (!this.supabase) {
      try {
        this.supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
      } catch (err) {
        this.handleRemoteError(err);
        return null;
      }
    }
    return this.supabase;
  }

  /** 인증 실패 등 재시도해도 해결되지 않는 오류는 원격 조회 자체를 끈다. */
  private handleRemoteError(error: unknown): void {
    if (isSupabaseAuthError(error)) {
      this.remoteDisabled = true;
      if (!this.remoteWarningNotified) {
        console.warn(
          '[Gateway] Supabase 인증 실패 — 원격 할당량 동기화를 중단합니다. SUPABASE_SERVICE_ROLE_KEY를 확인하세요.'
        );
        this.remoteWarningNotified = true;
      }
      return;
    }
    console.error('[Gateway] Supabase quota operation failed:', error);
  }

  async initialize(): Promise<void> {
    await this.loadExhaustedKeys();
  }

  private async loadExhaustedKeys(): Promise<void> {
    const client = this.getSupabase();
    if (!client) return;
    const now = new Date().toISOString();
    const { data, error } = await client
      .from('gateway_quota_exhausted')
      .select('provider, model, api_key_hash, reset_at')
      .gt('reset_at', now);

    if (error) {
      this.handleRemoteError(error);
      return;
    }

    this.exhaustedMap.clear();
    for (const row of data ?? []) {
      const resetAtMs = row.reset_at ? new Date(row.reset_at).getTime() : Number.NaN;
      if (!Number.isFinite(resetAtMs)) continue;
      this.exhaustedMap.set(this.buildKey(row.provider, row.model, row.api_key_hash), resetAtMs);
    }
    console.info(`[Gateway] Loaded ${this.exhaustedMap.size} exhausted keys from Supabase`);
    if (this.exhaustedMap.size > 0) {
      console.info(`[Gateway] Exhausted: ${Array.from(this.exhaustedMap.keys()).join(', ')}`);
    }
  }

  /**
   * 소진 시점부터 24시간 뒤를 기본 리셋 시각으로 쓴다.
   * 제공사가 응답 헤더/에러 메시지에 알려준 시각이 있으면 그것을 우선한다.
   */
  private resolveResetAt(hint?: { header?: string | null; errorBody?: string }): Date {
    const now = Date.now();
    const resetAtMs =
      parseResetAt(hint?.header, now) ?? parseResetAt(hint?.errorBody, now) ?? fallbackResetAt(now);
    return new Date(resetAtMs);
  }

  async markExhausted(
    provider: LLMProvider,
    model: string,
    apiKey: string,
    hint?: { header?: string | null; errorBody?: string }
  ): Promise<void> {
    const hash = this.getApiKeyHash(apiKey);
    const exhaustedAt = new Date();
    const resetAt = this.resolveResetAt(hint);

    // 인메모리 즉시 반영
    this.exhaustedMap.set(this.buildKey(provider, model, hash), resetAt.getTime());

    // Supabase 비동기 기록 (응답 지연 없음). 인증 실패 시 인메모리 상태만 유지한다.
    const client = this.getSupabase();
    if (!client) return;
    void client
      .from('gateway_quota_exhausted')
      .upsert(
        {
          provider,
          model,
          api_key_hash: hash,
          exhausted_at: exhaustedAt.toISOString(),
          reset_at: resetAt.toISOString(),
        },
        {
          onConflict: 'provider,model,api_key_hash',
        }
      )
      .then(
        (result) => {
          if (result.error) this.handleRemoteError(result.error);
        },
        (err: unknown) => this.handleRemoteError(err)
      );
  }

  isExhaustedLocal(provider: LLMProvider, model: string, apiKey: string): boolean {
    this.pruneExpiredLocal();
    const hash = this.getApiKeyHash(apiKey);
    return this.exhaustedMap.has(this.buildKey(provider, model, hash));
  }

  async isExhausted(provider: LLMProvider, model: string, apiKey: string): Promise<boolean> {
    // 1차: 인메모리 확인 (0ms)
    if (this.isExhaustedLocal(provider, model, apiKey)) return true;

    // 2차: Supabase 확인 (캐시 미스 시)
    const client = this.getSupabase();
    if (!client) return false;
    const hash = this.getApiKeyHash(apiKey);
    const now = new Date().toISOString();

    const { data, error } = await client
      .from('gateway_quota_exhausted')
      .select('id')
      .eq('provider', provider)
      .eq('model', model)
      .eq('api_key_hash', hash)
      .gt('reset_at', now)
      .single();

    if (error) {
      // 캐시 미스는 정상적인 상황이므로 조회 실패는 조용히 인메모리 결과만 반환한다.
      if (isSupabaseAuthError(error)) this.handleRemoteError(error);
      return false;
    }
    return !!data;
  }

  async cleanupExpired(): Promise<number> {
    const client = this.getSupabase();
    if (!client) return 0;
    const now = new Date().toISOString();
    const { error, count } = await client
      .from('gateway_quota_exhausted')
      .delete()
      .lt('reset_at', now);

    if (error) {
      this.handleRemoteError(error);
      return 0;
    }

    // 인메모리 캐시도 재로드
    await this.loadExhaustedKeys();
    return count ?? 0;
  }

  private pruneExpiredLocal(): void {
    const now = Date.now();
    for (const [key, resetAtMs] of this.exhaustedMap.entries()) {
      if (resetAtMs <= now) this.exhaustedMap.delete(key);
    }
  }

  // 디버그용
  getExhaustedSet(): Set<string> {
    this.pruneExpiredLocal();
    return new Set(this.exhaustedMap.keys());
  }

  getExhaustedMap(): Map<string, number> {
    this.pruneExpiredLocal();
    return new Map(this.exhaustedMap);
  }
}

export const quotaManager = new QuotaManager();
