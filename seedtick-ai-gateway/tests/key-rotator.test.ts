// key-rotator.test.ts
import { describe, expect, test } from 'bun:test';
import { KeyRotator } from '../src/domain/key-rotator/KeyRotator';
import type { ApiKeyPool } from '../src/domain/types';

describe('KeyRotator', () => {
  test('유휴 상태에서는 등록된 순서대로 키를 반환한다 (1번키 우선)', () => {
    const rotator = new KeyRotator([
      { provider: 'openrouter', keys: ['key1', 'key2', 'key3', 'key4', 'key5'] } as ApiKeyPool,
    ]);
    const keys = rotator.getKeysForProvider('openrouter');
    expect(keys).toEqual(['key1', 'key2', 'key3', 'key4', 'key5']);
  });

  test('1번키 사용 중이면 2번키가 우선 할당된다', () => {
    const rotator = new KeyRotator([
      { provider: 'openrouter', keys: ['key1', 'key2', 'key3'] } as ApiKeyPool,
    ]);

    // 1번키 점유
    rotator.acquireKey('openrouter', 'key1');
    expect(rotator.getActiveCount('openrouter', 'key1')).toBe(1);

    const keys = rotator.getKeysForProvider('openrouter');
    // 미사용 키인 key2, key3가 앞에 오고 key1은 뒤로 배치
    expect(keys[0]).toBe('key2');
    expect(keys[1]).toBe('key3');
    expect(keys[2]).toBe('key1');
  });

  test('1번, 2번키 사용 중이면 3번키가 우선 할당된다', () => {
    const rotator = new KeyRotator([
      { provider: 'openrouter', keys: ['key1', 'key2', 'key3', 'key4'] } as ApiKeyPool,
    ]);

    // 1번, 2번키 동시 점유
    rotator.acquireKey('openrouter', 'key1');
    rotator.acquireKey('openrouter', 'key2');

    const keys = rotator.getKeysForProvider('openrouter');
    expect(keys[0]).toBe('key3');
    expect(keys[1]).toBe('key4');
    // 사용 중인 키들은 뒤로
    expect(keys.slice(2)).toEqual(['key1', 'key2']);
  });

  test('요청 종료(releaseKey) 후 다시 1번키가 우선 할당된다', () => {
    const rotator = new KeyRotator([
      { provider: 'openrouter', keys: ['key1', 'key2', 'key3'] } as ApiKeyPool,
    ]);

    rotator.acquireKey('openrouter', 'key1');
    expect(rotator.getKeysForProvider('openrouter')[0]).toBe('key2');

    // 1번키 반환
    rotator.releaseKey('openrouter', 'key1');
    expect(rotator.getActiveCount('openrouter', 'key1')).toBe(0);

    // 다시 1번키가 최우선
    expect(rotator.getKeysForProvider('openrouter')[0]).toBe('key1');
    expect(rotator.getKeysForProvider('openrouter')).toEqual(['key1', 'key2', 'key3']);
  });

  test('모든 키가 사용 중일 때는 active 수가 가장 적은 키를 우선한다', () => {
    const rotator = new KeyRotator([
      { provider: 'openrouter', keys: ['key1', 'key2', 'key3'] } as ApiKeyPool,
    ]);

    rotator.acquireKey('openrouter', 'key1');
    rotator.acquireKey('openrouter', 'key1'); // key1 active = 2
    rotator.acquireKey('openrouter', 'key2'); // key2 active = 1
    rotator.acquireKey('openrouter', 'key3'); // key3 active = 1

    const keys = rotator.getKeysForProvider('openrouter');
    // key2와 key3는 active=1, key1은 active=2
    // key2와 key3 중에서는 등록 인덱스가 빠른 key2가 우선
    expect(keys[0]).toBe('key2');
    expect(keys[1]).toBe('key3');
    expect(keys[2]).toBe('key1');
  });

  test('getKeyStates로 키별 모니터링 정보를 조회할 수 있다', () => {
    const rotator = new KeyRotator([
      { provider: 'openrouter', keys: ['sk-or-v1-abcdef01', 'sk-or-v1-abcdef02'] } as ApiKeyPool,
    ]);
    rotator.acquireKey('openrouter', 'sk-or-v1-abcdef01');

    const states = rotator.getKeyStates('openrouter');
    expect(states).toEqual([
      { index: 1, apiKeyHash: 'abcdef01', active: 1 },
      { index: 2, apiKeyHash: 'abcdef02', active: 0 },
    ]);
  });

  test('키가 없는 제공사는 빈 배열 반환', () => {
    const rotator = new KeyRotator([]);
    const keys = rotator.getKeysForProvider('openrouter');
    expect(keys).toEqual([]);
  });

  test('hasKeys로 키 존재 여부 확인', () => {
    const rotator = new KeyRotator([{ provider: 'openrouter', keys: ['key1'] } as ApiKeyPool]);
    expect(rotator.hasKeys('openrouter')).toBe(true);
    expect(rotator.hasKeys('kilo')).toBe(false);
  });

  test('getAllProviders로 등록된 제공사 목록 조회', () => {
    const rotator = new KeyRotator([
      { provider: 'openrouter', keys: ['key1'] } as ApiKeyPool,
      { provider: 'kilo', keys: ['key2'] } as ApiKeyPool,
    ]);
    const providers = rotator.getAllProviders();
    expect(providers).toContain('openrouter');
    expect(providers).toContain('kilo');
    expect(providers).toHaveLength(2);
  });
});
