// gemini-adapter.test.ts - GeminiAdapter 스트리밍 변환 및 에러 처리 테스트
import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { GeminiAdapter } from '../src/domain/proxy/adapters/GeminiAdapter.ts';

describe('GeminiAdapter.callStream', () => {
  let fetchSpy: ReturnType<typeof spyOn> | null = null;

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = null;
  });

  it('Gemini SSE 청크를 OpenAI 호환 SSE 스트림으로 변환한다', async () => {
    const encoder = new TextEncoder();
    const geminiSse = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"안녕"}]},"index":0}]}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"하세요"}]},"finishReason":"STOP","index":0}]}\n\n'
          )
        );
        controller.close();
      },
    });

    let requestedUrl = '';
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (input: unknown) => {
      requestedUrl = String(input);
      return new Response(geminiSse, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as unknown as typeof fetch);

    const adapter = new GeminiAdapter({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
      apiKeys: ['gm-key'],
      queryAuth: true,
    });

    const result = await adapter.callStream(
      { messages: [{ role: 'user', content: '인사해줘' }], stream: true },
      'gemini-3.5-flash-lite',
      'gm-key'
    );

    expect(requestedUrl).toContain(
      'gemini-3.5-flash-lite:streamGenerateContent?alt=sse&key=gm-key'
    );
    expect(result.ok).toBe(true);
    expect(result.stream).toBeDefined();
    const sseText = await new Response(result.stream).text();
    expect(sseText).toContain('"object":"chat.completion.chunk"');
    expect(sseText).toContain('"role":"assistant"');
    expect(sseText).toContain('"content":"안녕"');
    expect(sseText).toContain('"content":"하세요"');
    expect(sseText).toContain('"finish_reason":"stop"');
    expect(sseText).toContain('data: [DONE]');
  });

  it('HTTP 429 응답은 스트림을 시작하지 않고 실패를 반환한다', async () => {
    fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
          status: 429,
        })) as unknown as typeof fetch
    );

    const adapter = new GeminiAdapter({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/',
      apiKeys: ['gm-key'],
      queryAuth: true,
    });

    const result = await adapter.callStream(
      { messages: [{ role: 'user', content: 'hi' }], stream: true },
      'gemini-3.5-flash-lite',
      'gm-key'
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
  });
});
