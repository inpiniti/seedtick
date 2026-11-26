// ErrorLogService.ts - Supabase error_logs 테이블 연동 에러/이벤트 로거
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { env } from '../../config/env.ts';
import { hasSupabaseCredentials, isSupabaseAuthError } from '../../config/supabase.ts';

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
/** 잘못된 서비스 롤 키는 재배포 전까지 복구되지 않으므로 더 오래 중단한다 (1시간). */
const AUTH_FAILURE_PAUSE_MS = 60 * 60 * 1000;
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
    if (hasSupabaseCredentials()) {
      try {
        this.supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);
      } catch (err) {
        console.warn('[ErrorLogger] Failed to create Supabase client:', err);
      }
    }
    return this.supabase;
  }

  /** 동일 원인으로 로그가 반복되지 않도록 한 번만 알리고 원격 로깅을 중단한다. */
  private pauseRemoteLogging(reason: string, durationMs: number): void {
    this.remoteLoggingPausedUntil = Date.now() + durationMs;
    if (!this.circuitNotified) {
      console.warn(
        `[ErrorLogger] ${reason} — ${Math.round(durationMs / 60_000)}분간 원격 로깅을 중단합니다.`
      );
      this.circuitNotified = true;
    }
  }

  private handleInsertError(error: { message?: string; code?: string }): void {
    if (isSupabaseAuthError(error)) {
      this.pauseRemoteLogging(
        'Supabase 인증 실패 (SUPABASE_SERVICE_ROLE_KEY 확인 필요)',
        AUTH_FAILURE_PAUSE_MS
      );
      return;
    }
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
    if (isSupabaseAuthError(err)) {
      this.pauseRemoteLogging(
        'Supabase 인증 실패 (SUPABASE_SERVICE_ROLE_KEY 확인 필요)',
        AUTH_FAILURE_PAUSE_MS
      );
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (!NETWORK_FAILURE_PATTERN.test(message)) {
      console.warn('[ErrorLogger] Error writing to error_logs table:', err);
      return;
    }
    this.pauseRemoteLogging('Supabase 연결 실패', REMOTE_LOG_PAUSE_MS);
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
