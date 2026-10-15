// tests/setup.ts - 테스트 설정

// 전역 테스트 설정
import { vi } from 'bun:test';

// 콘솔 로그 억제 (필요시)
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};
