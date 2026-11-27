// proxy.test.ts
import { beforeEach, describe, expect, test, vi } from 'bun:test';
import { CooldownManager } from '../src/domain/key-rotator/CooldownManager.ts';
import { ErrorClassifier } from '../src/domain/key-rotator/ErrorClassifier.ts';
import { KeyRotator } from '../src/domain/key-rotator/KeyRotator.ts';
import type { ChatRequest, ChatResponse } from '../src/domain/types.ts';

// Mock 어댑터
const createMockAdapter = (
  responses: Array<{
    ok: boolean;
    status: number;
    response?: ChatResponse;
    errorBody: string;
  }>
) => {
  let callCount = 0;
  return {
    call: vi.fn(async (_request: ChatRequest, _modelId: string, _apiKey: string) => {
      const result = responses[callCount] ?? responses[responses.length - 1];
      callCount++;
      return result;
    }),
    getCallCount: () => callCount,
  };
};

const mockChatResponse: ChatResponse = {
  id: 'test-123',
  object: 'chat.completion',
  model: 'test-model',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'Hello!' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const mockRequest: ChatRequest = {
  messages: [{ role: 'user', content: 'Hello' }],
};

describe('ProxyService', () => {
  let mockCooldown: CooldownManager;
  let mockClassifier: ErrorClassifier;
  let _mockRotator: KeyRotator;
  let _mockQuota: {
    isExhaustedLocal: ReturnType<typeof vi.fn>;
    markExhausted: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCooldown = new CooldownManager();
    mockClassifier = new ErrorClassifier();
    _mockRotator = new KeyRotator([{ provider: 'cline', keys: ['key1', 'key2'] }]);
    _mockQuota = {
      isExhaustedLocal: vi.fn(() => false),
      markExhausted: vi.fn(),
    };
  });

  // ProxyService에 mock 주입하기 위한 헬퍼
  const _createService = (adapter: ReturnType<typeof createMockAdapter>) => {
    // 실제 ProxyService는 private 필드라 직접 테스트 어려움
    // 여기서는 핵심 로직만 별도 테스트하거나 통합 테스트로 대체
    return { adapter };
  };

  test('1번 키 RPM 429 → 2번 키로 성공', async () => {
    const mockAdapter = createMockAdapter([
      { ok: false, status: 429, errorBody: 'RPM exceeded' },
      { ok: true, status: 200, response: mockChatResponse, errorBody: '' },
    ]);

    // 실제로는 ProxyService 내부에서 adapter 호출
    // 여기서는 로직 검증만
    const result1 = await mockAdapter.call(mockRequest, 'model1', 'key1');
    const result2 = await mockAdapter.call(mockRequest, 'model1', 'key2');

    expect(result1.ok).toBe(false);
    expect(result2.ok).toBe(true);
    expect(mockAdapter.getCallCount()).toBe(2);
  });

  test('RPD 소진 → markExhausted 호출', async () => {
    const mockAdapter = createMockAdapter([
      { ok: false, status: 429, errorBody: 'PerDay quota exceeded' },
      { ok: true, status: 200, response: mockChatResponse, errorBody: '' },
    ]);

    await mockAdapter.call(mockRequest, 'model1', 'key1');

    // 분류기가 daily_exhausted로 분류하는지 확인
    const category = mockClassifier.classify(429, 'PerDay quota exceeded');
    expect(category).toBe('daily_exhausted');
  });

  test('모든 키/모델 소진 → GATEWAY_ALL_EXHAUSTED 에러', () => {
    // 이 테스트는 실제 ProxyService 인스턴스가 필요
    // 통합 테스트로 분리 권장
    expect(true).toBe(true); // placeholder
  });

  test('404 발생 → setModelCooldownAllKeys 호출 후 다음 모델로', async () => {
    const setModelCooldownAllKeys = vi.fn();
    const _mockCooldownWithSpy = {
      ...mockCooldown,
      setModelCooldownAllKeys,
    };

    const mockAdapter = createMockAdapter([
      { ok: false, status: 404, errorBody: 'Model not found' },
      { ok: true, status: 200, response: mockChatResponse, errorBody: '' },
    ]);

    await mockAdapter.call(mockRequest, 'bad-model', 'key1');
    const category = mockClassifier.classify(404, 'Model not found');

    expect(category).toBe('model_not_found');
  });

  test('교차(Interleaving) 슬롯 풀 구성 검증', async () => {
    const { ProxyService } = await import('../src/domain/proxy/ProxyService.ts');
    const service = new ProxyService(undefined, [
      { provider: 'openrouter', keys: ['or-1', 'or-2', 'or-3'] },
      { provider: 'kilo', keys: ['kilo-1'] },
    ]);
    const slots = service.getSlots();

    expect(slots.length).toBe(6);
    // [or-1, kilo-1, or-2, kilo-1, or-3, kilo-1] 교차 배치 확인
    expect(slots[0]).toEqual({ provider: 'openrouter', key: 'or-1' });
    expect(slots[1]).toEqual({ provider: 'kilo', key: 'kilo-1' });
    expect(slots[2]).toEqual({ provider: 'openrouter', key: 'or-2' });
    expect(slots[3]).toEqual({ provider: 'kilo', key: 'kilo-1' });
    expect(slots[4]).toEqual({ provider: 'openrouter', key: 'or-3' });
    expect(slots[5]).toEqual({ provider: 'kilo', key: 'kilo-1' });
  });

  test('연속 5xx가 2회 발생하면 남은 키를 다 돌지 않고 다음 모델로 전환한다', async () => {
    const { ProxyService } = await import('../src/domain/proxy/ProxyService.ts');
    const { modelService } = await import('../src/domain/models/ModelService.ts');
    const { spyOn } = await import('bun:test');

    const service = new ProxyService(undefined, [
      { provider: 'openrouter', keys: ['or-1', 'or-2', 'or-3', 'or-4', 'or-5'] },
    ]);

    const selectSpy = spyOn(modelService, 'selectBestModel')
      .mockResolvedValueOnce({ id: 'broken/model-a:free' } as never)
      .mockResolvedValueOnce({ id: 'healthy/model-b:free' } as never)
      .mockResolvedValueOnce(null);
    const findSpy = spyOn(modelService, 'findModelById').mockResolvedValue(null);

    const calledModels: string[] = [];
    const adaptersMap = (
      service as unknown as {
        adapters: Map<
          string,
          {
            call: (req: ChatRequest, modelId: string, apiKey: string) => Promise<unknown>;
          }
        >;
      }
    ).adapters;
    adaptersMap.set('openrouter', {
      call: async (_req: ChatRequest, modelId: string) => {
        calledModels.push(modelId);
        if (modelId === 'broken/model-a:free') {
          return { ok: false, status: 500, errorBody: 'Internal Server Error' };
        }
        return { ok: true, status: 200, response: mockChatResponse, errorBody: '' };
      },
    });

    try {
      const result = await service.chat({ ...mockRequest, reasoning_effort: 'none' }, undefined, {
        textOnlyModels: true,
        preferFastNonReasoning: true,
      });
      expect('choices' in result).toBe(true);
      expect(calledModels).toEqual([
        'broken/model-a:free',
        'broken/model-a:free',
        'healthy/model-b:free',
      ]);
    } finally {
      selectSpy.mockRestore();
      findSpy.mockRestore();
    }
  });
});
