// openai-compat-adapter.test.ts - 추론 토큰 오염 방지 테스트
import { describe, expect, it, spyOn } from 'bun:test';
import { OpenAICompatAdapter } from '../src/domain/proxy/adapters/OpenAICompatAdapter.ts';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('OpenAICompatAdapter', () => {
  it("reasoning_effort 'none'을 null로 버리지 않고 그대로 전달한다", async () => {
    let sentBody: Record<string, unknown> = {};
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
      _input: unknown,
      init?: RequestInit
    ) => {
      sentBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return jsonResponse({
        choices: [
          { index: 0, message: { role: 'assistant', content: '안녕!' }, finish_reason: 'stop' },
        ],
        usage: {},
      });
    }) as unknown as typeof fetch);

    try {
      const adapter = new OpenAICompatAdapter({
        baseUrl: 'https://example.com/v1/chat/completions',
        apiKeys: ['test-key'],
      });
      const result = await adapter.call(
        { messages: [{ role: 'user', content: '안녕?' }], reasoning_effort: 'none' },
        'test-model',
        'test-key'
      );

      expect(result.ok).toBe(true);
      expect(sentBody.reasoning_effort).toBe('none');
      expect(sentBody.reasoning).toEqual({ effort: 'none' });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('content가 비어 있고 reasoning만 있으면 성공으로 위장하지 않는다', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      jsonResponse({
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '', reasoning: 'I should answer in Korean...' },
            finish_reason: 'stop',
          },
        ],
        usage: {},
      })) as unknown as typeof fetch);

    try {
      const adapter = new OpenAICompatAdapter({
        baseUrl: 'https://example.com/v1/chat/completions',
        apiKeys: ['test-key'],
      });
      const result = await adapter.call(
        { messages: [{ role: 'user', content: '안녕?' }] },
        'test-model',
        'test-key'
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe(422);
      expect(result.errorBody).toContain('reasoning_exhausted');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
