// tests/discussions-route.test.ts - /v1/discussions/prepare 검색어 추출 및 브리핑 테스트

import { describe, expect, it, spyOn } from 'bun:test';
import { app } from '../src/app.ts';
import {
  type DiscussionPrepPayload,
  buildNewsSearchQuery,
} from '../src/domain/discussions/DiscussionPrepService.ts';
import { proxyService } from '../src/domain/proxy/ProxyService.ts';
import type { ChatResponse } from '../src/domain/types.ts';

function makeChatResponse(content: string): ChatResponse {
  return {
    id: 'test-prep',
    object: 'chat.completion',
    model: 'test-model',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

describe('buildNewsSearchQuery', () => {
  it('prefers keyword and context tokens instead of conversational sentences', () => {
    const query = buildNewsSearchQuery(
      '요즘 20만원 들고 폰 사러 갔다가 당황한 사람들이 많대. 최신형 살래 아니면 가성비 살래?',
      '메모리 가격 상승과 공시지원금 축소 여파',
      '스마트폰 가격'
    );
    expect(query).toContain('스마트폰');
    expect(query).toContain('가격');
    expect(query).toContain('메모리');
    expect(query).not.toContain('살래?');
    expect(query).not.toContain('요즘');
  });
});

describe('POST /v1/discussions/prepare', () => {
  it('passes keyword to search query and returns curated briefing', async () => {
    const requestedUrls: string[] = [];
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async (
      input: Parameters<typeof fetch>[0]
    ) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      requestedUrls.push(url);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>삼성·애플 신형폰 할인 혜택 축소로 체감 가격 상승 - 한국경제</title>
    <link>https://news.google.com/articles/phone-1</link>
  </item>
</channel></rss>`,
        { status: 200 }
      );
    }) as unknown as typeof fetch);

    const chatSpy = spyOn(proxyService, 'chat').mockResolvedValue(
      makeChatResponse(
        JSON.stringify({
          background: '메모리 가격 인상과 공시지원금 축소가 겹쳐 스마트폰 체감 구매가가 올랐다.',
          facts: [
            {
              claim: '삼성·애플 신형폰 할인 혜택이 축소됐다.',
              source: '한국경제',
              url: 'https://news.google.com/articles/phone-1',
            },
          ],
          questions: ['지원금이 줄어든 상황에서 최신형과 보급형 중 무엇을 고를까?'],
          limitation: '',
        })
      )
    );

    try {
      const response = await app.handle(
        new Request('http://localhost/v1/discussions/prepare', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            topic: '요즘 폰 가격이 예상보다 훨씬 비싸졌대. 다음엔 어떤 폰을 고를래?',
            context: '메모리 가격 상승과 공시지원금 축소',
            keyword: '스마트폰 가격',
          }),
        })
      );

      expect(response.status).toBe(200);
      const json = (await response.json()) as DiscussionPrepPayload;
      expect(json.source).toBe('rss+llm');
      expect(json.briefing.facts).toHaveLength(1);
      expect(requestedUrls[0]).toContain(encodeURIComponent('스마트폰'));
    } finally {
      fetchSpy.mockRestore();
      chatSpy.mockRestore();
    }
  });

  it('rejects unsafe topic or keyword with 400 UNSAFE_TOPIC', async () => {
    const response = await app.handle(
      new Request('http://localhost/v1/discussions/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic: '오늘의 주요 소식 어떻게 생각해?',
          keyword: '음주운전',
        }),
      })
    );

    expect(response.status).toBe(400);
  });
});
