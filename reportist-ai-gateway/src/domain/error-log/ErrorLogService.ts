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

export class ErrorLogService {
  private supabase: SupabaseClient | null = null;

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

  async log(entry: LogEntry): Promise<void> {
    const client = this.getSupabase();
    if (!client) return;

    const row = {
      level: entry.level,
      logger_name: entry.loggerName ?? 'ai_gateway',
      code: entry.code,
      message: entry.message,
      context: entry.context ?? {},
    };

    try {
      const { error } = await client.from('error_logs').insert(row);
      if (error) {
        console.warn('[ErrorLogger] Failed to insert error_log:', error.message);
      }
    } catch (err) {
      console.warn('[ErrorLogger] Error writing to error_logs table:', err);
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
