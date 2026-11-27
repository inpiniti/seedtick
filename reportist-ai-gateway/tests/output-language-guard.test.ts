// output-language-guard.test.ts
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { modelService } from '../src/domain/models/ModelService.ts';
import {
  extractMessageText,
  hasForeignCjkScript,
  isKoreanOutput,
} from '../src/domain/proxy/OutputLanguageGuard.ts';
import { ProxyService } from '../src/domain/proxy/ProxyService.ts';
import type { ChatRequest, ChatResponse } from '../src/domain/types.ts';

function responseWith(content: string): ChatResponse {
  return {
    id: 'test-123',
    object: 'chat.completion',
    model: 'test-model',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

const mockRequest: ChatRequest = {
  messages: [
    { role: 'system', content: '한국어 반말로만 대사 한 줄을 출력한다.' },
    { role: 'user', content: '너는 펭귄이다. 인사해줘.' },
  ],
};

describe('OutputLanguageGuard', () => {
  test('한국어 문장은 통과한다', () => {
    expect(hasForeignCjkScript('좋아, 그럼 우리 직접 해보자!')).toBe(false);
    expect(isKoreanOutput(responseWith('오늘은 눈이 많이 오네! 같이 놀래?'))).toBe(true);
  });

  test('한국어 문장에 중국어가 섞이면 거부한다', () => {
    const mixed = '그건 괜찮은데 나는 좀 다르게 볼게. 我已经结束了。';
    expect(hasForeignCjkScript(mixed)).toBe(true);
    expect(isKoreanOutput(responseWith(mixed))).toBe(false);
  });

  test('중국어만 있거나 일본어 가나가 있으면 거부한다', () => {
    expect(isKoreanOutput(responseWith('我已经结束了。'))).toBe(false);
    expect(isKoreanOutput(responseWith('そうですね、行きましょう。'))).toBe(false);
  });

  test('단독 한자는 한자 표기로 허용한다', () => {
    expect(hasForeignCjkScript('이름은 森으로 표기해줘.')).toBe(false);
  });

  test('멀티모달 파트에서는 텍스트만 검사한다', () => {
    const content = [
      { type: 'text', text: '함께 눈사람 만들자!' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
    ];
    expect(extractMessageText(content)).toContain('눈사람');
    expect(
      isKoreanOutput({
        ...responseWith(''),
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      })
    ).toBe(true);
  });

  test('빈 choices는 거부한다', () => {
    expect(isKoreanOutput({ ...responseWith(''), choices: [] })).toBe(false);
  });
});

describe('ProxyService 한국어 출력 가드', () => {
  let selectSpy: ReturnType<typeof spyOn>;
  let findSpy: ReturnType<typeof spyOn>;

  const createService = (contents: string[]) => {
    const service = new ProxyService(undefined, [{ provider: 'openrouter', keys: ['or-1'] }]);
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

    const calledModels: string[] = [];
    const sentRequests: ChatRequest[] = [];
    let cursor = 0;
    adaptersMap.set('openrouter', {
      call: async (req: ChatRequest, modelId: string) => {
        calledModels.push(modelId);
        sentRequests.push(req);
        const content = contents[Math.min(cursor++, contents.length - 1)] ?? '';
        return {
          ok: true,
          status: 200,
          response: { ...responseWith(content), model: modelId },
          errorBody: '',
        };
      },
    });
    return { service, calledModels, sentRequests };
  };

  beforeEach(() => {
    selectSpy = spyOn(modelService, 'selectBestModel').mockResolvedValue(null);
    findSpy = spyOn(modelService, 'findModelById').mockResolvedValue(null);
  });

  test('중국어가 섞인 첫 모델을 거부하고 다음 모델의 한국어 응답을 반환한다', async () => {
    selectSpy
      .mockResolvedValueOnce({ id: 'bad/model-a:free' } as never)
      .mockResolvedValueOnce({ id: 'good/model-b:free' } as never);
    const { service, calledModels, sentRequests } = createService([
      '좋아, 같이 해보자. 我已经结束了。',
      '좋아, 그럼 우리 직접 해보자!',
    ]);

    const result = await service.chat(mockRequest, undefined, {
      textOnlyModels: true,
      preferFastNonReasoning: true,
    });

    expect('choices' in result).toBe(true);
    if (!('choices' in result)) return;
    expect(result.choices[0]?.message.content).toBe('좋아, 그럼 우리 직접 해보자!');
    expect(calledModels).toEqual(['bad/model-a:free', 'good/model-b:free']);
    // 텍스트 전용 요청은 게이트웨이가 언어 규칙을 프롬프트에도 보강한다.
    const systemContent = sentRequests[0]?.messages[0]?.content;
    expect(typeof systemContent).toBe('string');
    expect(String(systemContent)).toContain('중국어 한자와 일본어 가나를 한 글자도 사용하지 마라');
  });

  test('모든 후보가 중국어로 응답하면 출력 언어 오류를 반환한다', async () => {
    selectSpy.mockResolvedValueOnce({ id: 'bad/model-a:free' } as never);
    const { service, calledModels } = createService(['그래, 진행하자. 我们已经完成了。']);

    const result = await service.chat(mockRequest, undefined, {
      textOnlyModels: true,
      preferFastNonReasoning: true,
    });

    expect('error' in result).toBe(true);
    if (!('error' in result)) return;
    expect(result.error.code).toBe('GATEWAY_OUTPUT_LANGUAGE_REJECTED');
    expect(result.error.attempts[0]?.errorCategory).toBe('invalid_output_language');
    expect(calledModels).toEqual(['bad/model-a:free']);
  });

  test('텍스트 전용이 아닌 요청은 응답 언어를 검사하지 않는다', async () => {
    selectSpy.mockResolvedValueOnce({ id: 'any/model-a:free' } as never);
    const { service, sentRequests } = createService(['그래, 진행하자. 我已经结束了。']);

    const result = await service.chat(mockRequest, undefined, {
      preferFastNonReasoning: true,
    });

    expect('choices' in result).toBe(true);
    if (!('choices' in result)) return;
    expect(String(result.choices[0]?.message.content)).toContain('我已经结束了');
    // 일반 요청의 시스템 프롬프트는 그대로 유지한다.
    expect(sentRequests[0]?.messages[0]?.content).toBe(mockRequest.messages[0]?.content);
  });

  afterEach(() => {
    selectSpy.mockRestore();
    findSpy.mockRestore();
  });
});
