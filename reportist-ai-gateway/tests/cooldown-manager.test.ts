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
});
