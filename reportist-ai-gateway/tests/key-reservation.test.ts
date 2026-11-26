// key-reservation.test.ts - 사용 중 키를 다른 요청이 재사용하지 않는지 검증

import { describe, expect, test } from 'bun:test';
import type { CooldownManager } from '../src/domain/key-rotator/CooldownManager.ts';
import type { KeyRotator } from '../src/domain/key-rotator/KeyRotator.ts';
import { ProxyService } from '../src/domain/proxy/ProxyService.ts';
import type { KeySlot, LLMProvider } from '../src/domain/types.ts';

type SelectionInternals = {
  slotIndex: number;
  rotator: KeyRotator;
  cooldown: CooldownManager;
  quota: { exhaustedMap: Map<string, number> };
  getNextSlot(modelId?: string): KeySlot | null;
  orderKeysForUse(
    provider: LLMProvider,
    keys: string[],
    cursor: number
  ): Array<{ key: string; index: number }>;
};

const MODEL_ID = 'test/model:free';

function createService(): SelectionInternals {
  return new ProxyService(undefined, [
    { provider: 'openrouter', keys: ['or-1', 'or-2', 'or-3'] },
  ]) as unknown as SelectionInternals;
}

describe('키 예약 기반 슬롯 선택', () => {
  test('유휴 키가 있으면 라운드로빈 순서대로 선택한다', () => {
    const service = createService();
    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-1');
    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-2');
    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-3');
    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-1');
  });

  test('사용 중인 키는 건너뛰고 유휴 키를 우선 선택한다', () => {
    const service = createService();
    service.rotator.acquireKey('openrouter', 'or-1');

    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-2');
    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-3');
    // 유휴 키가 남아 있으면 active 키(or-1)는 다시 선택되지 않는다.
    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-2');
  });

  test('모든 키가 사용 중이면 active가 가장 적은 키로 폴백한다', () => {
    const service = createService();
    service.rotator.acquireKey('openrouter', 'or-1');
    service.rotator.acquireKey('openrouter', 'or-1');
    service.rotator.acquireKey('openrouter', 'or-2');
    service.rotator.acquireKey('openrouter', 'or-3');

    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-2');
  });

  test('사용을 마치면(active 0) 다시 선택 후보에 포함된다', () => {
    const service = createService();
    service.rotator.acquireKey('openrouter', 'or-1');
    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-2');

    service.rotator.releaseKey('openrouter', 'or-1');
    service.slotIndex = 0;
    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-1');
  });

  test('쿨다운/일일 소진 키는 선택 후보에서 제외한다', () => {
    const service = createService();
    service.cooldown.setCooldown('openrouter', MODEL_ID, 'or-1', 60_000, 'rpm_exceeded');
    // getApiKeyHash()는 키의 마지막 8자리를 사용한다.
    service.quota.exhaustedMap.set(`openrouter:${MODEL_ID}:or-2`, Date.now() + 60_000);

    expect(service.getNextSlot(MODEL_ID)?.key).toBe('or-3');
  });

  test('orderKeysForUse는 커서 기준으로 유휴 키를 먼저 정렬한다', () => {
    const service = createService();
    service.rotator.acquireKey('openrouter', 'or-1');

    const ordered = service.orderKeysForUse('openrouter', ['or-1', 'or-2', 'or-3'], 0);
    expect(ordered.map(({ key }) => key)).toEqual(['or-2', 'or-3', 'or-1']);
  });
});
