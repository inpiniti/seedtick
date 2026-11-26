// tests/env.test.ts - 환경 변수 로딩 및 Kilo 키 임시 차단 검증

import { afterEach, describe, expect, it } from 'bun:test';
import { loadEnv } from '../src/config/env.ts';

const ENV_KEYS = [
  'KILO_API_KEY',
  'KILO_API_KEYS',
  'OPENROUTER_API_KEY',
  'OPENROUTER_API_KEYS',
] as const;
const originals = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = originals.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe('loadEnv - Kilo 키 임시 차단', () => {
  it('KILO_API_KEY/KEYS가 설정되어도 kiloKeys는 비어 있다', () => {
    process.env.KILO_API_KEY = 'kilo-a,kilo-b';
    process.env.KILO_API_KEYS = 'kilo-c';

    expect(loadEnv().kiloKeys).toEqual([]);
  });

  it('다른 제공사 키는 평소대로 로드된다', () => {
    process.env.KILO_API_KEY = 'kilo-a';
    process.env.OPENROUTER_API_KEY = 'or-a, or-b';

    const config = loadEnv();
    expect(config.openrouterKeys).toEqual(['or-a', 'or-b']);
    expect(config.kiloKeys).toEqual([]);
  });

  it('기본 ProxyService 슬롯 풀에 Kilo 키가 포함되지 않는다', async () => {
    process.env.KILO_API_KEY = 'kilo-a';
    const { ProxyService } = await import('../src/domain/proxy/ProxyService.ts');

    const slots = new ProxyService().getSlots();
    expect(slots.filter((slot) => slot.provider === 'kilo')).toEqual([]);
  });
});
