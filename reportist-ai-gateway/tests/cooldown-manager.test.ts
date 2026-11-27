// cooldown-manager.test.ts
import { beforeEach, describe, expect, test } from 'bun:test';
import { CooldownManager } from '../src/domain/key-rotator/CooldownManager';

describe('CooldownManager', () => {
  let manager: CooldownManager;

  beforeEach(() => {
    manager = new CooldownManager();
  });

  test('쿨다운 등록 후 isCoolingDown이 true를 반환한다', () => {
    manager.setCooldown('cline', 'deepseek', 'key1', 60_000, 'test');
    expect(manager.isCoolingDown('cline', 'deepseek', 'key1')).toBe(true);
  });

  test('만료 후 isCoolingDown이 false를 반환한다', async () => {
    manager.setCooldown('cline', 'deepseek', 'key1', 10, 'test');
    await new Promise((r) => setTimeout(r, 20));
    expect(manager.isCoolingDown('cline', 'deepseek', 'key1')).toBe(false);
  });

  test('404 발생 시 모든 키에 쿨다운 적용', () => {
    const allKeys = ['key1', 'key2', 'key3'];
    manager.setModelCooldownAllKeys('cline', 'bad-model', allKeys, 86_400_000, '404');
    for (const key of allKeys) {
      expect(manager.isCoolingDown('cline', 'bad-model', key)).toBe(true);
    }
  });

  test('clear()로 전체 쿨다운 초기화', () => {
    manager.setCooldown('cline', 'model1', 'key1', 60_000, 'test');
    manager.clear();
    expect(manager.isCoolingDown('cline', 'model1', 'key1')).toBe(false);
  });

  test('다른 제공사/모델은 독립적', () => {
    manager.setCooldown('cline', 'model1', 'key1', 60_000, 'test');
    expect(manager.isCoolingDown('kilo', 'model1', 'key1')).toBe(false);
    expect(manager.isCoolingDown('cline', 'model2', 'key1')).toBe(false);
  });

  test('401 인증 실패 키는 모든 모델에서 즉시 차단된다', () => {
    manager.setProviderKeyCooldown('kilo', 'expired-key', 6 * 3_600_000, 'unauthorized');
    expect(manager.isCoolingDown('kilo', 'model-a', 'expired-key')).toBe(true);
    expect(manager.isCoolingDown('kilo', 'model-b', 'expired-key')).toBe(true);
    expect(manager.isCoolingDown('openrouter', 'model-a', 'expired-key')).toBe(false);
  });

  test('가드레일 거부는 같은 모델의 서로 다른 키 수와 키별 거부 횟수를 센다', () => {
    const first = manager.recordGuardrailRejection('openrouter', 'model-a', 'key-aaa11111');
    expect(first).toEqual({ distinctKeys: 1, keyRejections: 1 });
    expect(manager.recordGuardrailRejection('openrouter', 'model-a', 'key-aaa11111')).toEqual({
      distinctKeys: 1,
      keyRejections: 2,
    });
    expect(manager.recordGuardrailRejection('openrouter', 'model-a', 'key-bbb22222')).toEqual({
      distinctKeys: 2,
      keyRejections: 1,
    });
    expect(manager.recordGuardrailRejection('openrouter', 'model-b', 'key-ccc33333')).toEqual({
      distinctKeys: 1,
      keyRejections: 1,
    });
    expect(manager.recordGuardrailRejection('kilo', 'model-a', 'key-ddd44444')).toEqual({
      distinctKeys: 1,
      keyRejections: 1,
    });
  });

  test('모델 단위 가드레일 차단은 만료 후 해제된다', async () => {
    manager.blockModelForGuardrail('openrouter', 'model-a', 10);
    expect(manager.isModelGuardrailBlocked('openrouter', 'model-a')).toBe(true);
    expect(manager.isModelGuardrailBlocked('openrouter', 'model-b')).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(manager.isModelGuardrailBlocked('openrouter', 'model-a')).toBe(false);
  });

  test('clear()는 가드레일 추적 상태도 초기화한다', () => {
    manager.recordGuardrailRejection('openrouter', 'model-a', 'key-aaa11111');
    manager.blockModelForGuardrail('openrouter', 'model-a', 60_000);
    manager.clear();
    expect(manager.recordGuardrailRejection('openrouter', 'model-a', 'key-aaa11111')).toEqual({
      distinctKeys: 1,
      keyRejections: 1,
    });
    expect(manager.isModelGuardrailBlocked('openrouter', 'model-a')).toBe(false);
  });
});
