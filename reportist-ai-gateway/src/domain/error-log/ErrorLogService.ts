// ErrorLogService.ts - Supabase error_logs 테이블 연동 에러/이벤트 로거
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { env } from '../../config/env.ts';

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  level: LogLevel;
  code: string;
  message: string;
  context?: Record<string, unknown>;
  loggerName?: string;
}

/** Supabase 연결/DNS 장애 시 원격 로깅을 잠시 중단하는 서킷브레이커 (5분). */
const REMOTE_LOG_PAUSE_MS = 5 * 60 * 1000;
const NETWORK_FAILURE_PATTERN =
  /Unable to connect|Unable to establish|Could not connect|fetch failed|ENOTFOUND|EAI_AGAIN|getaddrinfo|Was there a typo|Connection refused|NetworkError|network timeout/i;

export class ErrorLogService {
  private supabase: SupabaseClient | null = null;
  private tableUnavailable = false;
  private remoteLoggingPausedUntil = 0;
  private circuitNotified = false;

  constructor(supabaseClient?: SupabaseClient) {
    if (supabaseClient) {
      this.supabase = supabaseClient;
    }
  }

  private getSupabase(): SupabaseClient | null {
    if (this.supabase) return this.supabase;
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        this.supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
      } catch (err) {
        console.warn('[ErrorLogger] Failed to create Supabase client:', err);
      }
    }
    return this.supabase;
  }

  private handleInsertError(error: { message?: string; code?: string }): void {
    if (error.code === '42P01' || /Could not find the table/i.test(error.message ?? '')) {
      if (!this.tableUnavailable) {
        console.warn(
          '[ErrorLogger] error_logs 테이블이 Supabase에 존재하지 않아 원격 로깅을 건너뜁니다.'
        );
        this.tableUnavailable = true;
      }
      return;
    }
    console.warn('[ErrorLogger] Failed to insert error_log:', error.message);
  }

  private handleInsertException(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (!NETWORK_FAILURE_PATTERN.test(message)) {
      console.warn('[ErrorLogger] Error writing to error_logs table:', err);
      return;
    }
    this.remoteLoggingPausedUntil = Date.now() + REMOTE_LOG_PAUSE_MS;
    if (!this.circuitNotified) {
      console.warn('[ErrorLogger] Supabase 연결 실패 — 5분간 원격 로깅을 중단합니다.');
      this.circuitNotified = true;
    }
  }

  async log(entry: LogEntry): Promise<void> {
    if (Date.now() >= this.remoteLoggingPausedUntil) this.circuitNotified = false;
    if (this.tableUnavailable || Date.now() < this.remoteLoggingPausedUntil) return;
    const client = this.getSupabase();
    if (!client) return;

    const row = {
      level: entry.level,
      logger_name: entry.loggerName ?? 'ai_gateway',
      code: entry.code,
      message: entry.message,
      context: entry.context ?? {},
    };

    // Supabase 왕복 지연이 키 로테이션 루프를 블로킹하지 않도록 fire-and-forget으로 보낸다.
    try {
      void Promise.resolve(client.from('error_logs').insert(row)).then(
        ({ error }) => {
          if (error) this.handleInsertError(error);
        },
        (err) => this.handleInsertException(err)
      );
    } catch (err) {
      this.handleInsertException(err);
    }
  }

  async critical(code: string, message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log({ level: 'CRITICAL', code, message, context });
  }

  async error(code: string, message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log({ level: 'ERROR', code, message, context });
  }

  async warning(code: string, message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log({ level: 'WARNING', code, message, context });
  }

  async info(code: string, message: string, context?: Record<string, unknown>): Promise<void> {
    return this.log({ level: 'INFO', code, message, context });
  }
}

export const errorLogService = new ErrorLogService();
