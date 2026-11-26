// model-compat.test.ts - 모델 스펙에 맞춘 요청 보정 및 모델 루프 중단 테스트

import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { modelService } from '../src/domain/models/ModelService.ts';
import { ProxyService } from '../src/domain/proxy/ProxyService.ts';
import type { ChatRequest, ErrorCategory, FreeModelMeta } from '../src/domain/types.ts';

type ProxyInternals = {
  adaptRequestForModel(request: ChatRequest, modelId: string): Promise<ChatRequest>;
  shouldBreakModelLoop(category: ErrorCategory): boolean;
};

const MODEL = {
  id: 'baidu/ernie-5.5-flash-preview:free',
  name: 'test',
  providerName: 'test',
  created: 0,
  createdDate: '2026-01-01',
  daysAgo: 0,
  contextLength: 1000,
  contextLengthFormatted: '1K',
  description: '',
  modality: 'text',
  intelligenceTier: 'free',
  parametersSummary: '',
  supportedParameters: [],
} as FreeModelMeta;

function request(): ChatRequest {
  return {
    messages: [{ role: 'user', content: '안녕' }],
    reasoning_effort: 'none',
    max_tokens: 64,
  };
}

function internals(): ProxyInternals {
  const proxy = new ProxyService(undefined, [{ provider: 'openrouter', keys: ['test-key'] }]);
  return proxy as unknown as ProxyInternals;
}

afterEach(() => {
  mock.restore();
});

describe('모델 추론 파라미터 보정', () => {
  test('추론이 필수인 모델에는 reasoning_effort를 보내지 않는다', async () => {
    spyOn(modelService, 'findModelById').mockImplementation((async () => ({
      ...MODEL,
      reasoningMandatory: true,
    })) as unknown as typeof modelService.findModelById);

    const adapted = await internals().adaptRequestForModel(
      request(),
      'baidu/ernie-5.5-flash-preview:free'
    );

    expect(adapted.reasoning_effort).toBeUndefined();
    expect(adapted.messages).toHaveLength(1);
    expect(adapted.max_tokens).toBe(64);
  });

  test('none을 지원하는 모델은 요청을 그대로 유지한다', async () => {
    spyOn(modelService, 'findModelById').mockImplementation((async () => ({
      ...MODEL,
      reasoningMandatory: false,
      supportsReasoning: true,
      supportedEfforts: ['none', 'low', 'high'],
    })) as unknown as typeof modelService.findModelById);

    const adapted = await internals().adaptRequestForModel(request(), MODEL.id);
    expect(adapted.reasoning_effort).toBe('none');
  });

  test('none을 지원하지 않는 모델도 파라미터를 제거한다', async () => {
    spyOn(modelService, 'findModelById').mockImplementation((async () => ({
      ...MODEL,
      supportedEfforts: ['low', 'high'],
    })) as unknown as typeof modelService.findModelById);

    const adapted = await internals().adaptRequestForModel(request(), MODEL.id);
    expect(adapted.reasoning_effort).toBeUndefined();
  });

  test('카탈로그에 없는 모델은 보정 없이 그대로 보낸다', async () => {
    spyOn(modelService, 'findModelById').mockImplementation(
      (async () => null) as unknown as typeof modelService.findModelById
    );

    const adapted = await internals().adaptRequestForModel(request(), 'unknown/model:free');
    expect(adapted.reasoning_effort).toBe('none');
  });
});

describe('모델 루프 중단', () => {
  test('reasoning_mandatory는 다음 모델로 넘어간다', () => {
    expect(internals().shouldBreakModelLoop('reasoning_mandatory')).toBe(true);
  });

  test('일반 unknown도 다음 모델로 넘어간다', () => {
    expect(internals().shouldBreakModelLoop('unknown')).toBe(true);
  });

  test('rate limit은 같은 모델의 다음 키로 재시도한다', () => {
    expect(internals().shouldBreakModelLoop('rpm_exceeded')).toBe(false);
  });
});
