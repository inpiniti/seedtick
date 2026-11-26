// TrendsService.ts - 한국 실시간 화제 수집·안전 필터링·30분 캐시 서비스

import { proxyService } from '../proxy/ProxyService.ts';

export interface TrendTopicItem {
  keyword: string;
  topic: string;
  context: string;
}

export interface TrendsPayload {
  items: TrendTopicItem[];
  updatedAt: string;
  source: 'rss+llm' | 'rss' | 'fallback';
}

export interface RawCandidate {
  keyword: string;
  headline: string;
  url: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const RSS_TIMEOUT_MS = 4500;
// 클라이언트(/v1/trends) 타임아웃(15초)보다 짧게 두어 LLM이 지연돼도 RSS 폴백을 먼저 돌려준다.
const LLM_CURATE_TIMEOUT_MS = 8_000;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const RSS_FEEDS = [
  {
    kind: 'google-trends' as const,
    url: 'https://trends.google.com/trending/rss?geo=KR',
  },
  {
    kind: 'google-news' as const,
    url: 'https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=ko&gl=KR&ceid=KR:ko',
  },
  {
    kind: 'google-news' as const,
    url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=ko&gl=KR&ceid=KR:ko',
  },
];

/** 아기 동물 배경 수다에 부적절한 사건·사고·범죄·재난·정치·전쟁 키워드 하드 필터. */
const BLOCKED_PATTERN =
  /(사망|숨져|숨진|시신|살인|살해|폭행|성폭행|성추행|성범죄|구속|체포|경찰|검찰|수사|기소|재판|징역|선고|화재|폭발|추락|참사|사고|지진|실종|학대|마약|도박|사기|피해자|용의자|부검|투신|극단적|대통령|국회|여당|야당|민주당|국민의힘|탄핵|대권|총선|대선|장관|의원|특검|계엄|정치|북한|미사일|전쟁|공습|폭격|테러|타결\s*불발|파업|사단|부대|동거|불륜|이혼|폭로)/i;

const BLOCKED_URL_PATTERN = /\/(politics|judicial|crime|disaster)\//i;

/** 다른 서비스(토론 자료 조사)에서도 같은 안전 기준을 쓰도록 공개한다. */
export function isSafeTopicText(text: string): boolean {
  return !BLOCKED_PATTERN.test(text);
}

/** 이미 토론한 주제와 새 주제가 겹치는지 비교할 때 쓰는 정규화 키. */
export function normalizeTopicKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s,.!?…·'"“”‘’()[\]]/g, '');
}

function matchesExcluded(text: string, excludes: Set<string>): boolean {
  const key = normalizeTopicKey(text);
  if (!key) return false;
  for (const excluded of excludes) {
    if (excluded.length >= 2 && key.includes(excluded)) return true;
  }
  return false;
}

export const FALLBACK_TREND_ITEMS: TrendTopicItem[] = [
  {
    keyword: '오픈런 맛집',
    topic: '맛집 새벽 오픈런 줄 서볼 수 있어?',
    context: '요즘 인기 디저트랑 한정 메뉴 먹으려고 새벽부터 줄 서는 게 유행이래',
  },
  {
    keyword: 'AI 비서',
    topic: '하루 일과를 AI한테 다 맡기면 편할까?',
    context: '일정 정리부터 메뉴 추천까지 AI한테 물어보는 사람이 훌쩍 늘었대',
  },
  {
    keyword: '겨울 간식',
    topic: '붕어빵은 팥이 최고야 슈크림이 최고야?',
    context: '날씨가 추워지면서 길거리 겨울 간식 지도 앱까지 다시 인기래',
  },
  {
    keyword: '숏폼 중독',
    topic: '자기 전에 짧은 영상 보면 왜 못 멈출까?',
    context: '딱 하나만 보려다가 한 시간 훌쩍 넘기는 사람이 많대',
  },
  {
    keyword: '무지출 챌린지',
    topic: '하루 동안 돈 한 푼 안 쓰기 가능해?',
    context: '아끼면서 재밌게 버티는 절약 챌린지가 요즘 화제래',
  },
  {
    keyword: '러닝 크루',
    topic: '추운 날 다 같이 달리는 거 재밌을까?',
    context: '밤공기 마시며 같이 뛰는 러닝 모임이 계속 유행하고 있대',
  },
  {
    keyword: 'OTT 정주행',
    topic: '주말에 몰아보기 좋은 작품 뭐가 있을까?',
    context: '새 시즌 공개되자마자 밤새 정주행하는 사람이 많대',
  },
  {
    keyword: '성격 유형',
    topic: '처음 만나면 성격 유형부터 물어보는 거 어때?',
    context: '친구 사귈 때 성향 테스트 결과를 먼저 나누는 게 일상화됐대',
  },
];

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_match: string, code: string) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPublisherSuffix(title: string): string {
  const idx = title.lastIndexOf(' - ');
  if (idx > 8 && title.length - idx <= 24) {
    return title.slice(0, idx).trim();
  }
  return title.trim();
}

/** [단독]·[속보] 같은 말머리 노이즈를 제거해 화제 핵심어가 가려지지 않게 한다. */
function stripHeadlineNoise(title: string): string {
  return title
    .replace(/^\s*\[[^\]]{1,10}\]\s*/g, '')
    .replace(/^\s*(단독|속보|긴급)\s*[:：]?\s*/g, '')
    .trim();
}

export function parseRssCandidates(
  xml: string,
  kind: 'google-trends' | 'google-news'
): RawCandidate[] {
  const out: RawCandidate[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const block = match[1] ?? '';
    const cleanTitle = stripHeadlineNoise(
      decodeXmlEntities(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
    );
    if (!cleanTitle) continue;

    if (kind === 'google-trends') {
      const newsTitle = stripHeadlineNoise(
        decodeXmlEntities(
          block.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] ?? ''
        )
      );
      const newsUrl = decodeXmlEntities(
        block.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1] ?? ''
      );
      out.push({
        keyword: cleanTitle.slice(0, 24),
        headline: stripPublisherSuffix(newsTitle || cleanTitle).slice(0, 180),
        url: newsUrl,
      });
    } else {
      const cleanHeadline = stripPublisherSuffix(cleanTitle);
      const link = decodeXmlEntities(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '');
      const shortKey = cleanHeadline
        .replace(/[\[\]()'"“”‘’…·,:!?]/g, ' ')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join(' ')
        .slice(0, 18);
      if (!shortKey) continue;
      out.push({
        keyword: shortKey,
        headline: cleanHeadline.slice(0, 180),
        url: link,
      });
    }
  }
  return out;
}

export function filterSafeCandidates(candidates: RawCandidate[]): RawCandidate[] {
  const seen = new Set<string>();
  const safe: RawCandidate[] = [];

  for (const item of candidates) {
    const combined = `${item.keyword} ${item.headline}`;
    if (BLOCKED_PATTERN.test(combined)) continue;
    if (item.url && BLOCKED_URL_PATTERN.test(item.url)) continue;

    const normKey = item.keyword.toLowerCase().replace(/\s+/g, '');
    if (!normKey || seen.has(normKey)) continue;
    seen.add(normKey);
    safe.push(item);
    if (safe.length >= 16) break;
  }
  return safe;
}

/** LLM 쿼터 소진 시에도 RSS만으로 자연스러운 토론 주제를 만드는 결정론적 변환기. */
export function buildDeterministicTopics(candidates: RawCandidate[]): TrendTopicItem[] {
  const suffixes = [
    '이거 어떻게 생각해?',
    '너희도 관심 있어?',
    '이거 좀 신기하지 않아?',
    '해보고 싶지 않아?',
  ];

  return candidates.slice(0, 10).map((c, idx) => {
    const k = c.keyword.slice(0, 12).trim();
    // topic에는 상황 전체를 담고, context에는 같은 말을 반복하지 않는 배경을 둔다.
    const headline = c.headline.replace(/\s+/g, ' ').trim().slice(0, 180);
    const suffix = suffixes[idx % suffixes.length] ?? '이거 어떻게 생각해?';
    const topic = `${headline} ${suffix}`.slice(0, 240);
    return {
      keyword: k,
      topic,
      context: `요즘 '${k}' 관련 이야기가 자주 보이는데, 함께 얘기해 보자.`,
    };
  });
}

export class TrendsService {
  private cache: TrendsPayload | null = null;
  private lastFetchTime = 0;
  private inFlight: Promise<TrendsPayload> | null = null;

  async getTrends(): Promise<TrendsPayload> {
    const now = Date.now();
    if (this.cache && now - this.lastFetchTime < CACHE_TTL_MS) {
      return this.cache;
    }

    if (this.cache) {
      if (!this.inFlight) {
        this.inFlight = this.refresh().finally(() => {
          this.inFlight = null;
        });
      }
      return this.cache;
    }

    if (!this.inFlight) {
      this.inFlight = this.refresh().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  /**
   * 이미 토론한 주제를 제외한 새 트렌드 배치를 만든다.
   * 기본 30분 캐시와 분리되어 매번 RSS를 다시 수집하므로 같은 주제가 반복되지 않는다.
   */
  async getTrendsExcluding(excluded: string[]): Promise<TrendsPayload> {
    const excludes = new Set(
      excluded.map((value) => normalizeTopicKey(value)).filter((value) => value.length >= 2)
    );
    if (excludes.size === 0) return this.getTrends();

    const lists = await Promise.all(RSS_FEEDS.map((feed) => this.fetchFeed(feed)));
    const merged: RawCandidate[] = [];
    const maxLen = Math.max(0, ...lists.map((list) => list.length));
    for (let i = 0; i < maxLen; i += 1) {
      for (const list of lists) {
        const candidate = list[i];
        if (candidate) merged.push(candidate);
      }
    }

    const safe = filterSafeCandidates(merged).filter(
      (candidate) => !matchesExcluded(`${candidate.keyword} ${candidate.headline}`, excludes)
    );
    const updatedAt = new Date().toISOString();
    const curated = safe.length > 0 ? await this.curateWithLLM(safe, excludes) : null;
    const items = (curated ?? (safe.length > 0 ? buildDeterministicTopics(safe) : [])).filter(
      (item) => !matchesExcluded(`${item.keyword} ${item.topic}`, excludes)
    );

    return {
      items,
      updatedAt,
      source: curated ? 'rss+llm' : safe.length > 0 ? 'rss' : 'fallback',
    };
  }

  private async fetchFeed(feed: (typeof RSS_FEEDS)[number]): Promise<RawCandidate[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const xml = await res.text();
      return parseRssCandidates(xml, feed.kind);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  private async curateWithLLM(
    candidates: RawCandidate[],
    excludes: Set<string> = new Set()
  ): Promise<TrendTopicItem[] | null> {
    const numbered = candidates
      .slice(0, 14)
      .map((c, i) => `${i + 1}. [${c.keyword}] ${c.headline}`)
      .join('\n');
    const avoidLine =
      excludes.size > 0
        ? `\n이미 토론한 주제 ${[...excludes].slice(0, 20).join(', ')}와 같은 화제는 절대 다시 고르지 마라.`
        : '';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_CURATE_TIMEOUT_MS);
    try {
      const result = await Promise.race([
        proxyService.chat(
          {
            messages: [
              {
                role: 'system',
                content: `너는 귀여운 아기 동물들의 설원 수다방 작가다. 입력된 오늘의 한국 뉴스/트렌드 목록에서 사건·사고·범죄·정치·진영 갈등·부고·사적인 가십은 모두 버리고, 음식·일상·문화·영화·음악·게임·IT·스포츠·계절 유행처럼 가볍고 재밌는 화제 6~8개를 골라 JSON 배열로만 출력해라. 각 원소는 {"keyword":"핵심어(10자이내)","topic":"뉴스 제목과 핵심 내용을 그대로 포함한 구체적인 상황에 찬반·취향 질문을 붙인 문장(100~180자, 최대 220자. 짧게 줄이지 말 것)","context":"왜 화제인지 배경을 다른 관점으로 1줄(42자이내)"} 형식이다. topic에는 주제만 읽어도 상황이 이해되도록 충분히 쓸 것. context는 topic과 같은 문장을 반복하지 말고 배경만 쓸 것. 마크다운 코드블록 없이 순수 JSON 배열만 출력해라.${avoidLine}`,
              },
              {
                role: 'user',
                content: numbered,
              },
            ],
            temperature: 0.5,
            max_tokens: 4000,
            reasoning_effort: 'none',
            stream: false,
          },
          undefined,
          { textOnlyModels: true }
        ),
        new Promise<never>((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => reject(new Error('timeout')), {
            once: true,
          });
        }),
      ]);

      if ('error' in result) return null;
      const raw = String(result.choices?.[0]?.message?.content ?? '');
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start === -1 || end <= start) return null;

      const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
      if (!Array.isArray(parsed)) return null;

      const items: TrendTopicItem[] = [];
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue;
        const rec = entry as Record<string, unknown>;
        const keyword = typeof rec.keyword === 'string' ? rec.keyword.trim().slice(0, 16) : '';
        const topic = typeof rec.topic === 'string' ? rec.topic.trim().slice(0, 240) : '';
        const context = typeof rec.context === 'string' ? rec.context.trim().slice(0, 120) : '';
        if (
          !keyword ||
          topic.length < 4 ||
          BLOCKED_PATTERN.test(`${keyword} ${topic} ${context}`) ||
          matchesExcluded(`${keyword} ${topic}`, excludes)
        ) {
          continue;
        }
        items.push({ keyword, topic, context });
      }
      return items.length >= 3 ? items.slice(0, 10) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async refresh(): Promise<TrendsPayload> {
    const lists = await Promise.all(RSS_FEEDS.map((f) => this.fetchFeed(f)));
    const merged: RawCandidate[] = [];
    const maxLen = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < maxLen; i++) {
      for (const list of lists) {
        const item = list[i];
        if (item) merged.push(item);
      }
    }

    const safe = filterSafeCandidates(merged);
    const updatedAt = new Date().toISOString();

    if (safe.length === 0) {
      const fallbackPayload: TrendsPayload = {
        items: FALLBACK_TREND_ITEMS,
        updatedAt,
        source: 'fallback',
      };
      this.cache = fallbackPayload;
      this.lastFetchTime = Date.now();
      return fallbackPayload;
    }

    const curated = await this.curateWithLLM(safe);
    const payload: TrendsPayload = curated
      ? { items: curated, updatedAt, source: 'rss+llm' }
      : { items: buildDeterministicTopics(safe), updatedAt, source: 'rss' };

    this.cache = payload;
    this.lastFetchTime = Date.now();
    return payload;
  }
}

export const trendsService = new TrendsService();
