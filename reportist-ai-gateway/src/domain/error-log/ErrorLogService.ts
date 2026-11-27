// ErrorLogService.ts - 콘솔 기반 에러/이벤트 로거
// 원격 DB가 없어도 Vercel 런타임 로그에 구조화된 이벤트를 남긴다.
export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  level: LogLevel;
  code: string;
  message: string;
  context?: Record<string, unknown>;
  loggerName?: string;
}

export class ErrorLogService {
  async log(entry: LogEntry): Promise<void> {
    const prefix = `[ErrorLogger] ${entry.level} ${entry.code}: ${entry.message}`;
    const context = entry.context ?? {};
    switch (entry.level) {
      case 'CRITICAL':
      case 'ERROR':
        console.error(prefix, context);
        break;
      case 'WARNING':
        console.warn(prefix, context);
        break;
      default:
        console.info(prefix, context);
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
