// opencode.test.ts — OpenCode 무료 브릿지 프로바이더
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test';
import { env } from '../src/config/env.ts';
import type { ErrorLogService } from '../src/domain/error-log/ErrorLogService.ts';
import { ModelService } from '../src/domain/models/ModelService.ts';
import { ProxyService } from '../src/domain/proxy/ProxyService.ts';
import type { ChatRequest, ChatResponse, FreeModelMeta } from '../src/domain/types.ts';

const chatResponse: ChatResponse = {
  id: 'chatcmpl-opencode-test',
  object: 'chat.completion',
  model: 'opencode/hy4-flash-free',
  choices: [{ index: 0, message: { role: 'assistant', content: 'PONG' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
};

const request: ChatRequest = {
  model: 'opencode/hy4-flash-free',
  messages: [{ role: 'user', content: 'Reply with PONG' }],
};

const criticalMock = vi.fn(async () => undefined);
const logger = { critical: criticalMock } as unknown as ErrorLogService;
const originalFetch = globalThis.fetch;

describe('OpenCode bridge provider', () => {
  beforeEach(() => {
    env.opencodeKeys = ['oc_sk_key111111', 'oc_sk_key222222'];
    env.opencodeBaseUrl = 'http://bridge.test/v1/chat/completions';
    env.gatewaySecret = 'gateway-secret';
    env.geminiKeys = [];
    env.openrouterKeys = [];
    env.kiloKeys = [];
    criticalMock.mockClear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('opencode 모델 요청은 브릿지로 전달되고 키/시크릿 헤더가 설정된다', async () => {
    const spy = vi.fn(
      async (_input: unknown, _init?: RequestInit) =>
        new Response(JSON.stringify(chatResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    const service = new ProxyService(logger);
    const result = await service.chat(request, 'oc_sk_override');

    expect('error' in result).toBe(false);
    const [, init] = spy.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-OpenCode-Api-Key']).toBe('oc_sk_override');
    expect(headers.Authorization).toBe('Bearer gateway-secret');
    expect(headers.Authorization).not.toContain('oc_sk_override');
  });

  test('429 응답이면 다음 키로 전환한다', async () => {
    const spy = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      if (headers['X-OpenCode-Api-Key'] === 'oc_sk_key111111') {
        return new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
          status: 429,
        });
      }
      return new Response(JSON.stringify(chatResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = spy as unknown as typeof fetch;

    const service = new ProxyService(logger);
    const result = await service.chat(request);

    expect('error' in result).toBe(false);
    const usedKeys = spy.mock.calls.map(
      (call) => (call[1]?.headers as Record<string, string>)['X-OpenCode-Api-Key']
    );
    expect(usedKeys).toContain('oc_sk_key111111');
    expect(usedKeys).toContain('oc_sk_key222222');
  });

  test('모든 키 소진 시 명시적 에러를 반환하고 다른 제공사로 폴백하지 않는다', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429 })
    ) as unknown as typeof fetch;

    const service = new ProxyService(logger);
    const result = await service.chat(request);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.code).toBe('GATEWAY_OPENCODE_EXHAUSTED');
      expect(result.error.attempts).toHaveLength(2);
    }
    expect(logger.critical).toHaveBeenCalled();
  });

  test('모든 OpenCode 무료 모델이 /v1/models 메타데이터에 포함된다', () => {
    const service = new ModelService();
    const models = (
      service as unknown as { withImageModels: (m: never[]) => FreeModelMeta[] }
    ).withImageModels([]);
    const ids = models.map((m) => m.id);

    expect(ids).toContain('opencode/hy4-flash-free');
    expect(ids).toContain('opencode/deepseek-v4.1-flash-free');
    expect(ids).toContain('opencode/beam-free');
    expect(ids.filter((id) => id.startsWith('opencode/')).length).toBe(10);
  });

  test('OpenCode 모델은 실제 입력 모달리티와 capability를 노출한다', () => {
    const service = new ModelService();
    const models = (
      service as unknown as { withImageModels: (m: never[]) => FreeModelMeta[] }
    ).withImageModels([]);
    const byId = new Map(models.map((m) => [m.id, m]));

    const hy4 = byId.get('opencode/hy4-flash-free');
    expect(hy4?.inputModalities).toEqual(['text', 'image']);
    expect(hy4?.modality).toBe('text+image->text');
    expect(hy4?.dataPolicy?.training).toBe(true);
    expect(hy4?.supportsReasoning).toBe(true);
    expect(hy4?.supportsTools).toBe(true);
    expect(hy4?.supportedEfforts).toEqual(['none', 'high']);
    expect(hy4?.docsUrl).toBe('https://opencode.ai/docs/models/');

    const deepseek = byId.get('opencode/deepseek-v4.1-flash-free');
    expect(deepseek?.inputModalities).toEqual(['text', 'image']);
    expect(deepseek?.supportsReasoning).toBe(true);
    expect(deepseek?.supportsTools).toBe(true);
    expect(deepseek?.reasoningToggle).toBe(true);

    const beam = byId.get('opencode/beam-free');
    expect(beam?.inputModalities).toEqual(['text']);
  });
});
