// key-rotator.test.ts
import { describe, expect, test } from 'bun:test';
import { KeyRotator } from '../src/domain/key-rotator/KeyRotator';
import type { ApiKeyPool } from '../src/domain/types';

describe('KeyRotator', () => {
  test('랜덤 시작점으로 모든 키를 순환한다', () => {
    const rotator = new KeyRotator([
      { provider: 'cline', keys: ['key1', 'key2', 'key3'] } as ApiKeyPool,
    ]);
    const keys = rotator.getKeysForProvider('cline');
    expect(keys).toHaveLength(3);
    expect(new Set(keys)).toEqual(new Set(['key1', 'key2', 'key3']));
  });

  test('키가 없는 제공사는 빈 배열 반환', () => {
    const rotator = new KeyRotator([]);
    const keys = rotator.getKeysForProvider('cline');
    expect(keys).toEqual([]);
  });

  test('hasKeys로 키 존재 여부 확인', () => {
    const rotator = new KeyRotator([{ provider: 'cline', keys: ['key1'] } as ApiKeyPool]);
    expect(rotator.hasKeys('cline')).toBe(true);
    expect(rotator.hasKeys('kilo')).toBe(false);
  });

  test('getAllProviders로 등록된 제공사 목록 조회', () => {
    const rotator = new KeyRotator([
      { provider: 'cline', keys: ['key1'] } as ApiKeyPool,
      { provider: 'kilo', keys: ['key2'] } as ApiKeyPool,
    ]);
    const providers = rotator.getAllProviders();
    expect(providers).toContain('cline');
    expect(providers).toContain('kilo');
    expect(providers).toHaveLength(2);
  });
});
