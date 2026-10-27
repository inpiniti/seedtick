// QuotaManager.ts - Supabase 연동 일일 소진 키 관리

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { env } from '../../config/env.ts';
import type { LLMProvider } from '../types.ts';

export class QuotaManager {
  private supabase: SupabaseClient | null = null;
  private exhaustedSet = new Set<string>();

  private buildKey(provider: string, model: string, apiKeyHash: string): string {
    return `${provider}:${model}:${apiKeyHash}`;
  }

  private getApiKeyHash(apiKey: string): string {
    return apiKey.slice(-8);
  }

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      this.supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
    }
    return this.supabase;
  }

  async initialize(): Promise<void> {
    await this.loadExhaustedKeys();
  }

  private async loadExhaustedKeys(): Promise<void> {
    const now = new Date().toISOString();
    const { data, error } = await this.getSupabase()
      .from('gateway_quota_exhausted')
      .select('provider, model, api_key_hash')
      .gt('reset_at', now);

    if (error) {
      console.error('[Gateway] Failed to load exhausted keys:', error);
      return;
    }

    this.exhaustedSet.clear();
    for (const row of data ?? []) {
      this.exhaustedSet.add(this.buildKey(row.provider, row.model, row.api_key_hash));
    }
    console.info(`[Gateway] Loaded ${this.exhaustedSet.size} exhausted keys from Supabase`);
    if (this.exhaustedSet.size > 0) {
      console.info(`[Gateway] Exhausted: ${Array.from(this.exhaustedSet).join(', ')}`);
    }
  }

  private calcResetAt(provider: string): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    if (provider === 'gemini') {
      tomorrow.setUTCHours(env.geminiResetHour, 0, 0, 0);
    } else if (provider === 'cline') {
      tomorrow.setUTCHours(env.clineResetHour, 0, 0, 0);
    } else if (provider === 'kilo') {
      tomorrow.setUTCHours(env.kiloResetHour, 0, 0, 0);
    } else if (provider === 'openrouter') {
      tomorrow.setUTCHours(env.openrouterResetHour, 0, 0, 0);
    } else {
      tomorrow.setUTCHours(0, 0, 0, 0);
    }
    return tomorrow;
  }

  async markExhausted(provider: LLMProvider, model: string, apiKey: string): Promise<void> {
    const hash = this.getApiKeyHash(apiKey);
    const resetAt = this.calcResetAt(provider);

    // 인메모리 즉시 반영
    this.exhaustedSet.add(this.buildKey(provider, model, hash));

    // Supabase 비동기 기록 (응답 지연 없음)
    this.getSupabase()
      .from('gateway_quota_exhausted')
      .upsert(
        {
          provider,
          model,
          api_key_hash: hash,
          exhausted_at: new Date().toISOString(),
          reset_at: resetAt.toISOString(),
        },
        {
          onConflict: 'provider,model,api_key_hash',
        }
      )
      .then((result) => {
        if (result.error) console.error('[Gateway] Failed to mark exhausted:', result.error);
      });
  }

  isExhaustedLocal(provider: LLMProvider, model: string, apiKey: string): boolean {
    const hash = this.getApiKeyHash(apiKey);
    return this.exhaustedSet.has(this.buildKey(provider, model, hash));
  }

  async isExhausted(provider: LLMProvider, model: string, apiKey: string): Promise<boolean> {
    // 1차: 인메모리 확인 (0ms)
    if (this.isExhaustedLocal(provider, model, apiKey)) return true;

    // 2차: Supabase 확인 (캐시 미스 시)
    const hash = this.getApiKeyHash(apiKey);
    const now = new Date().toISOString();

    const { data, error } = await this.getSupabase()
      .from('gateway_quota_exhausted')
      .select('id')
      .eq('provider', provider)
      .eq('model', model)
      .eq('api_key_hash', hash)
      .gt('reset_at', now)
      .single();

    if (error) return false;
    return !!data;
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date().toISOString();
    const { error, count } = await this.getSupabase()
      .from('gateway_quota_exhausted')
      .delete()
      .lt('reset_at', now);

    if (error) {
      console.error('[Gateway] Cleanup failed:', error);
      return 0;
    }

    // 인메모리 캐시도 재로드
    await this.loadExhaustedKeys();
    return count ?? 0;
  }

  // 디버그용
  getExhaustedSet(): Set<string> {
    return this.exhaustedSet;
  }
}

export const quotaManager = new QuotaManager();
