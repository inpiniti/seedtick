// tests/trends-route.test.ts - /v1/trends 수집·필터·캐시·폴백 테스트

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { app } from '../src/app.ts';
import { proxyService } from '../src/domain/proxy/ProxyService.ts';
import {
  type TrendsPayload,
  filterSafeCandidates,
  parseRssCandidates,
  trendsService,
} from '../src/domain/trends/TrendsService.ts';
import type { ChatResponse } from '../src/domain/types.ts';

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss">
  <channel>
    <title>일간 인기 검색어</title>
    <item>
      <title>남동공단 화재</title>
      <ht:news_item_title>공장 화재로 소방대 출동 - 뉴스</ht:news_item_title>
      <ht:news_item_url>https://news.google.com/articles/disaster-1</ht:news_item_url>
    </item>
    <item>
      <title>김민석 오세훈 대권</title>
      <ht:news_item_title>여당 야당 대권 구도 논란 - 정치</ht:news_item_title>
      <ht:news_item_url>https://news.google.com/articles/politics-1</ht:news_item_url>
    </item>
    <item>
      <title>리트 냥이</title>
      <ht:news_item_title>경찰 수사 협조 요청 - 사건</ht:news_item_title>
      <ht:news_item_url>https://news.google.com/articles/crime-1</ht:news_item_url>
    </item>
    <item>
      <title>맥도날드</title>
      <ht:news_item_title>새벽 2시 오픈런 300명 줄 - 생활</ht:news_item_title>
      <ht:news_item_url>https://news.google.com/articles/life-1</ht:news_item_url>
    </item>
    <item>
      <title>붕어빵 지도</title>
      <ht:news_item_title>겨울 간식 지도 앱 인기 - 문화</ht:news_item_title>
      <ht:news_item_url>https://news.google.com/articles/culture-1</ht:news_item_url>
    </item>
  </channel>
</rss>`;

function resetCache(): void {
  const mutable = trendsService as unknown as {
    cache: TrendsPayload | null;
    lastFetchTime: number;
    inFlight: Promise<TrendsPayload> | null;
  };
  mutable.cache = null;
  mutable.lastFetchTime = 0;
  mutable.inFlight = null;
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

afterEach(() => {
  resetCache();
});

describe('TrendsService filtering', () => {
  it('blocks incident/crime/politics headlines but keeps everyday trends', () => {
    const candidates = parseRssCandidates(RSS_XML, 'google-trends');
    expect(candidates.length).toBe(5);

    const safe = filterSafeCandidates(candidates);
    const keywords = safe.map((item) => item.keyword);
    expect(keywords).not.toContain('남동공단 화재');
    expect(keywords).not.toContain('김민석 오세훈 대권');
    expect(keywords).not.toContain('리트 냥이');
    expect(keywords).toContain('맥도날드');
    expect(keywords).toContain('붕어빵 지도');
  });
});

describe('GET /v1/trends', () => {
  it('returns 200 without auth and sets cache-control', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () => new Response(RSS_XML, { status: 200 })) as unknown as typeof fetch
    );
    const chatSpy = spyOn(proxyService, 'chat').mockResolvedValue(
      makeChatResponse(
        JSON.stringify([
          { keyword: '맥도날드', topic: '새벽 오픈런 갈래?', context: '한정 메뉴 줄이 길대' },
          { keyword: '붕어빵', topic: '붕어빵 팥이 최고야?', context: '겨울 간식 인기' },
          { keyword: '산책', topic: '같이 설원 산책 할래?', context: '날씨가 좋아졌대' },
        ])
      )
    );

    try {
      const response = await app.handle(new Request('http://localhost/v1/trends'));
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('s-maxage=1800');
      const json = (await response.json()) as TrendsPayload;
      expect(json.items.length).toBeGreaterThanOrEqual(3);
      expect(json.source).toBe('rss+llm');
      expect(fetchSpy).toHaveBeenCalled();
      expect(chatSpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      chatSpy.mockRestore();
    }
  });

  it('serves the second request from memory cache without refetching', async () => {
    let fetchCalls = 0;
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () => {
      fetchCalls += 1;
      return new Response(RSS_XML, { status: 200 });
    }) as unknown as typeof fetch);
    const chatSpy = spyOn(proxyService, 'chat').mockResolvedValue(
      makeChatResponse(
        JSON.stringify([
          { keyword: '맥도날드', topic: '새벽 오픈런 갈래?', context: '한정 메뉴 줄이 길대' },
          { keyword: '붕어빵', topic: '붕어빵 팥이 최고야?', context: '겨울 간식 인기' },
          { keyword: '산책', topic: '같이 설원 산책 할래?', context: '날씨가 좋아졌대' },
        ])
      )
    );

    try {
      const first = await app.handle(new Request('http://localhost/v1/trends'));
      const firstJson = (await first.json()) as TrendsPayload;
      await app.handle(new Request('http://localhost/v1/trends'));
      expect(fetchCalls).toBe(3); // RSS 피드 3개를 한 번만 호출
      expect(firstJson.updatedAt).toBeTruthy();
    } finally {
      fetchSpy.mockRestore();
      chatSpy.mockRestore();
    }
  });

  it('refreshes a non-overlapping batch when exclude is provided', async () => {
    let fetchCalls = 0;
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((async () => {
      fetchCalls += 1;
      return new Response(RSS_XML, { status: 200 });
    }) as unknown as typeof fetch);
    let chatCalls = 0;
    let secondSystemPrompt = '';
    const chatSpy = spyOn(proxyService, 'chat').mockImplementation((async (request) => {
      chatCalls += 1;
      if (chatCalls === 2) secondSystemPrompt = String(request.messages[0]?.content ?? '');
      const items =
        chatCalls === 1
          ? [
              { keyword: '맥도날드', topic: '새벽 오픈런 갈래?', context: '한정 메뉴 줄이 길대' },
              { keyword: '붕어빵', topic: '붕어빵 팥이 최고야?', context: '겨울 간식 인기' },
              { keyword: '산책', topic: '같이 설원 산책 할래?', context: '날씨가 좋아졌대' },
            ]
          : [
              { keyword: '맥도날드', topic: '새벽 오픈런 갈래?', context: '한정 메뉴 줄이 길대' },
              { keyword: '영화', topic: '주말 영화 볼래?', context: '새 영화 개봉' },
              { keyword: '산책', topic: '같이 설원 산책 할래?', context: '날씨가 좋아졌대' },
              { keyword: '게임', topic: '새 게임 해볼래?', context: '신작이 나왔대' },
            ];
      return makeChatResponse(JSON.stringify(items));
    }) as typeof proxyService.chat);

    try {
      const first = await app.handle(new Request('http://localhost/v1/trends'));
      expect((await first.json() as TrendsPayload).items).toHaveLength(3);
      expect(fetchCalls).toBe(3);

      const second = await app.handle(
        new Request(`http://localhost/v1/trends?exclude=${encodeURIComponent('맥도날드,붕어빵')}`)
      );
      expect(second.status).toBe(200);
      expect(second.headers.get('cache-control')).toContain('no-store');
      expect(fetchCalls).toBe(6); // 캐시를 우회해 RSS를 다시 수집
      expect(secondSystemPrompt).toContain('이미 토론한 주제');
      const keywords = ((await second.json()) as TrendsPayload).items.map((item) => item.keyword);
      expect(keywords).not.toContain('맥도날드');
      expect(keywords).toEqual(['영화', '산책', '게임']);
    } finally {
      fetchSpy.mockRestore();
      chatSpy.mockRestore();
    }
  });

  it('falls back to deterministic RSS topics when the LLM fails', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () => new Response(RSS_XML, { status: 200 })) as unknown as typeof fetch
    );
    const chatSpy = spyOn(proxyService, 'chat').mockResolvedValue({
      error: { code: 'GATEWAY_ALL_EXHAUSTED', message: 'no keys' },
    } as never);

    try {
      const response = await app.handle(new Request('http://localhost/v1/trends'));
      expect(response.status).toBe(200);
      const json = (await response.json()) as TrendsPayload;
      expect(json.source).toBe('rss');
      expect(json.items.length).toBeGreaterThan(0);
      expect(json.items[0]?.topic).toContain('?');
    } finally {
      fetchSpy.mockRestore();
      chatSpy.mockRestore();
    }
  });
});
