// tests/discussions-route.test.ts - /v1/discussions/prepare 조사·캐시·안전 필터 테스트

import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { app } from '../src/app.ts';
import { env } from '../src/config/env.ts';
import { discussionPrepService } from '../src/domain/discussions/DiscussionPrepService.ts';
import type { DiscussionPrepPayload } from '../src/domain/discussions/DiscussionPrepService.ts';
import { proxyService } from '../src/domain/proxy/ProxyService.ts';
import type { ChatResponse } from '../src/domain/types.ts';

type Payload = DiscussionPrepPayload & { error?: { code: string; message: string } };

async function json(response: Response): Promise<Payload> {
  return (await response.json()) as Payload;
}

const NEWS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item><title>겨울 간식 지도 앱 인기</title><link>https://news.google.com/articles/snack-map</link></item>
  <item><title>붕어빵 가격 인상 이야기</title><link>https://news.google.com/articles/snack-price</link></item>
</channel></rss>`;

function resetCache(): void {
  const mutable = discussionPrepService as unknown as {
    cache: Map<string, unknown>;
    inFlight: Map<string, unknown>;
  };
  mutable.cache.clear();
  mutable.inFlight.clear();
}

function makeChatResponse(content: string): ChatResponse {
  return {
    id: 'test',
    object: 'chat.completion',
    model: 'test-model',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

function request(topic: string, context?: string): Request {
  return new Request('http://localhost/v1/discussions/prepare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.gatewaySecret}`,
    },
    body: JSON.stringify({ topic, context }),
  });
}

afterEach(() => {
  resetCache();
  mock.restore();
});

describe('POST /v1/discussions/prepare', () => {
  it('returns an LLM-curated briefing with source links', async () => {
    spyOn(globalThis, 'fetch').mockImplementation(
      (async () => new Response(NEWS_XML, { status: 200 })) as unknown as typeof fetch
    );
    const chatSpy = spyOn(proxyService, 'chat').mockImplementation((async () =>
      makeChatResponse(
        JSON.stringify({
          background: '겨울 간식 지도 앱이 인기다. 붕어빵 이야기가 함께 나온다.',
          facts: [
            {
              claim: '겨울 간식 지도 앱이 인기를 끌고 있어요.',
              source: 'Google News',
              url: 'https://news.google.com/articles/snack-map',
            },
          ],
          questions: ['붕어빵은 팥이 최고야?'],
          limitation: '',
        })
      )) as unknown as typeof proxyService.chat);

    const response = await app.handle(request('붕어빵 지도', '겨울 간식 지도 앱 인기'));
    expect(response.status).toBe(200);
    const payload = await json(response);
    expect(payload.source).toBe('rss+llm');
    expect(payload.briefing.background.length).toBeGreaterThan(8);
    expect(payload.briefing.facts[0].url).toBe('https://news.google.com/articles/snack-map');
    expect(chatSpy).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached briefing for the same topic', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () => new Response(NEWS_XML, { status: 200 })) as unknown as typeof fetch
    );
    const chatSpy = spyOn(proxyService, 'chat').mockImplementation((async () =>
      makeChatResponse(
        JSON.stringify({
          background: '충분히 긴 배경 설명 문장이에요.',
          facts: [{ claim: '확인된 사실이에요.', source: 'Google News' }],
          questions: ['어떻게 생각해?'],
        })
      )) as unknown as typeof proxyService.chat);

    await app.handle(request('붕어빵 지도'));
    await app.handle(request('붕어빵 지도'));
    expect(chatSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects a topic with crime or politics keywords', async () => {
    const response = await app.handle(request('강남 살인 사건 발생'));
    expect(response.status).toBe(400);
    const payload = await json(response);
    expect(payload.error?.code).toBe('UNSAFE_TOPIC');
  });

  it('falls back to search facts when the LLM fails', async () => {
    spyOn(globalThis, 'fetch').mockImplementation(
      (async () => new Response(NEWS_XML, { status: 200 })) as unknown as typeof fetch
    );
    spyOn(proxyService, 'chat').mockImplementation((async () => ({
      error: { code: 'NO_KEY', message: 'no key', type: 'gateway_error' },
    })) as unknown as typeof proxyService.chat);

    const response = await app.handle(request('붕어빵 지도'));
    expect(response.status).toBe(200);
    const payload = await json(response);
    expect(payload.source).toBe('rss');
    expect(payload.briefing.facts.length).toBeGreaterThan(0);
    expect(payload.briefing.limitation).toContain('헤드라인');
  });
});
