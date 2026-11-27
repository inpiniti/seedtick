// model-compat.test.ts - 모델 스펙에 맞춘 요청 보정 및 모델 루프 중단 테스트

import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { modelService } from '../src/domain/models/ModelService.ts';
import { ProxyService } from '../src/domain/proxy/ProxyService.ts';
import type { ChatRequest, ErrorCategory, FreeModelMeta } from '../src/domain/types.ts';

type ProxyInternals = {
  adaptRequestForModel(request: ChatRequest, modelId: string): Promise<ChatRequest>;
  resolveTargetModels(
    requestedModel: string | undefined,
    requiredInputs: Array<'text' | 'image' | 'audio' | 'video'>,
    outputModality: 'text' | 'image' | 'audio' | 'video',
    textOnlyModels?: boolean,
    preferFastNonReasoning?: boolean
  ): Promise<string[]>;
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
    // 추론 강제 모델은 reasoning이 예산을 소진하지 않도록 최소 출력 토큰을 보장한다.
    expect(adapted.max_tokens).toBe(1024);
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

describe('채팅 대상 모델 필터링', () => {
  const IMAGE_MODEL = {
    ...MODEL,
    id: 'recraft/recraft-v4.1-flash-v2:free',
    modality: 'text->image',
    outputModalities: ['image'],
    isImageGenerationModel: true,
  } as FreeModelMeta;

  test('이미지 생성 모델이 채팅으로 지정되면 자동 텍스트 모델로 대체한다', async () => {
    spyOn(modelService, 'findModelById').mockImplementation(
      (async () => IMAGE_MODEL) as unknown as typeof modelService.findModelById
    );
    let selectCount = 0;
    spyOn(modelService, 'selectBestModel').mockImplementation((async () => {
      selectCount += 1;
      if (selectCount > 1) return null;
      return { ...MODEL, id: 'candidate/text:free' };
    }) as unknown as typeof modelService.selectBestModel);

    const targets = await internals().resolveTargetModels(IMAGE_MODEL.id, [], 'text');

    expect(targets).not.toContain(IMAGE_MODEL.id);
    expect(targets).toContain('candidate/text:free');
  });

  test('출력 모달리티가 맞는 텍스트 모델은 그대로 사용한다', async () => {
    spyOn(modelService, 'findModelById').mockImplementation(
      (async () => MODEL) as unknown as typeof modelService.findModelById
    );

    const targets = await internals().resolveTargetModels(MODEL.id, [], 'text');

    expect(targets[0]).toBe(MODEL.id);
  });
});

describe('모델 루프 중단', () => {
  test('추론 토큰 소진은 다음 모델로 넘어간다', () => {
    expect(internals().shouldBreakModelLoop('reasoning_exhausted')).toBe(true);
  });

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
