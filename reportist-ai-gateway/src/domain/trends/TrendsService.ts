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
  subHeadlines?: string[];
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const FALLBACK_CACHE_TTL_MS = 30 * 1000;
const RSS_TIMEOUT_MS = 4500;
// 첫 화면을 막지 않도록 동기 대기는 10.5초로 제한하고, 시간 내 못 끝나면 백그라운드에서 완료 시 캐시를 승격한다.
const LLM_CURATE_WAIT_MS = 10_500;

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

/** 아기 동물 배경 수다에 부적절한 사건·사고·범죄·재난·정치·전쟁·자극적 가십 키워드 하드 필터. */
const BLOCKED_PATTERN =
  /(사망|숨져|숨진|시신|살인|살해|폭행|성폭행|성추행|성범죄|구속|체포|경찰|검찰|수사|기소|재판|징역|실형|고소|고발|피소|선고|화재|폭발|추락|참사|사고|지진|실종|학대|마약|도박|사기|피해자|용의자|부검|투신|극단적|대통령|국회|여당|야당|민주당|국민의힘|탄핵|대권|총선|대선|장관|의원|특검|계엄|정치|북한|미사일|전쟁|공습|폭격|테러|타결\s*불발|파업|사단|부대|동거|불륜|이혼|폭로|폭락|눈물|음주운전|빚더미|부작용|두드러기|특종세상|별별TV|앵커리포트|전남편|전처|결별|파경|열애설)/i;

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

/**
 * LLM이 JSON 배열을 끝까지 만들지 못해도 완성된 객체는 살려서 쓴다.
 * 긴 주제를 여러 개 요청하면 토큰 한도에서 배열 중간이 잘리는 경우가 흔하다.
 */
export function parseCuratedArray(raw: string): unknown[] | null {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  const slice = start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim();
  try {
    const parsed = JSON.parse(slice) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // 닫는 괄호가 없어도 균형 잡힌 객체는 복구한다.
    const entries: unknown[] = [];
    let depth = 0;
    let objStart = -1;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < slice.length; i += 1) {
      const ch = slice[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        if (depth === 0) objStart = i;
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0 && objStart >= 0) {
          try {
            entries.push(JSON.parse(slice.slice(objStart, i + 1)) as unknown);
          } catch {
            // 손상된 객체는 건너뛴다.
          }
          objStart = -1;
        }
      }
    }
    return entries.length > 0 ? entries : null;
  }
}

export const FALLBACK_TREND_ITEMS: TrendTopicItem[] = [
  {
    keyword: '오픈런 맛집',
    topic:
      '인기 디저트랑 한정 메뉴 먹으려고 새벽부터 오픈런 줄 서는 게 유행인데, 직접 줄 서볼 수 있어?',
    context: 'SNS 인증 열풍으로 희소성 높은 한정 메뉴 대기 행렬이 길어지고 있대',
  },
  {
    keyword: 'AI 비서',
    topic:
      '일정 정리부터 메뉴 추천까지 하루 일과를 AI한테 다 맡기는 사람이 늘었는데, 전부 맡기면 편할까?',
    context: '개인 맞춤형 AI 도구 사용이 일상 업무와 생활 전반으로 번지고 있대',
  },
  {
    keyword: '겨울 간식',
    topic: '길거리 겨울 간식 지도 앱까지 다시 인기라는데, 붕어빵은 팥이 최고야 슈크림이 최고야?',
    context: '날씨가 추워지면서 동네 노점 위치 공유와 취향 논쟁이 활발해졌대',
  },
  {
    keyword: '숏폼 중독',
    topic:
      '자기 전에 딱 하나만 보려다가 한 시간 훌쩍 넘기는 사람이 많대. 짧은 영상 볼 때 왜 못 멈출까?',
    context: '알고리즘 추천과 빠른 화면 전환이 시청 시간을 늘리는 요인이래',
  },
  {
    keyword: '무지출 챌린지',
    topic:
      '아끼면서 재밌게 버티는 무지출 절약 챌린지가 다시 화제인데, 하루 동안 돈 한 푼 안 쓰기 가능해?',
    context: '고물가 흐름 속에 소소한 절약 인증과 소비 점검이 유행하고 있대',
  },
  {
    keyword: '러닝 크루',
    topic:
      '밤공기 마시며 여럿이 같이 뛰는 러닝 모임이 계속 유행하고 있대. 추운 날 다 같이 달리는 거 어때?',
    context: '혼자 운동하기보다 함께 기록을 공유하는 커뮤니티 문화가 자리 잡았대',
  },
  {
    keyword: 'OTT 정주행',
    topic:
      '새 시즌 공개되자마자 밤새 정주행하는 사람이 많대. 주말에 몰아보기 좋은 작품 뭐가 있을까?',
    context: '주간 공개 대신 전편 동시 공개 작품이 늘며 몰아보기 수요가 커졌대',
  },
  {
    keyword: '성격 유형',
    topic:
      '처음 만날 때 성격 유형 테스트 결과를 먼저 물어보는 게 자연스러워졌는데, 첫인상 판단에 도움이 될까?',
    context: '짧은 시간 안에 성향과 대화 코드를 맞추려는 소통 방식이 퍼졌대',
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
  let cleaned = title.trim();
  for (const sep of [' - ', ' – ', ' — ', ' | ']) {
    const idx = cleaned.lastIndexOf(sep);
    if (idx > 8 && cleaned.length - idx <= 24) {
      cleaned = cleaned.slice(0, idx).trim();
    }
  }
  return cleaned;
}

/** [단독]·[속보] 머릿말과 [특종세상]·[앵커리포트] 같은 꼬리말 노이즈를 함께 제거한다. */
function stripHeadlineNoise(title: string): string {
  return title
    .replace(/^\s*\[[^\]]{1,12}\]\s*/g, '')
    .replace(/(?:\s*\[[^\]]{1,12}\])+\s*$/g, '')
    .replace(/^\s*(단독|속보|긴급|영상|포토|인터뷰|종합)\s*[:：]?\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNewsTitle(raw: string): string {
  // 꼬리 태그([특종세상]) 제거 전후로 언론사 접미사(- 머니투데이)가 붙어 있을 수 있어 양쪽 순서로 정제한다.
  return stripHeadlineNoise(stripPublisherSuffix(stripHeadlineNoise(decodeXmlEntities(raw))));
}

function hasKorean(text: string): boolean {
  return /[가-힣]/.test(text);
}

function extractGoogleNewsKeyword(cleanHeadline: string): string {
  const tokens = cleanHeadline
    .replace(/[[\]()'"“”‘’…·,:!?]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  // 시간·수량 수식어로 시작하는 첫 토큰('두 달', '오늘' 등)만 잘려 키워드가 되는 현상을 줄인다.
  const leadingStopWords = new Set([
    '오늘',
    '어제',
    '내일',
    '최근',
    '요즘',
    '결국',
    '다시',
    '드디어',
  ]);
  const meaningful = tokens.filter((token, idx) => idx > 0 || !leadingStopWords.has(token));
  const picked = (meaningful.length >= 2 ? meaningful : tokens).slice(0, 2).join(' ');
  return picked.slice(0, 18).trim();
}

export function parseRssCandidates(
  xml: string,
  kind: 'google-trends' | 'google-news'
): RawCandidate[] {
  const out: RawCandidate[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const block = match[1] ?? '';
    const cleanTitle = cleanNewsTitle(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    if (!cleanTitle) continue;

    if (kind === 'google-trends') {
      const newsBlocks = Array.from(block.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g));
      const extractedNews: Array<{ title: string; url: string }> = [];
      for (const newsMatch of newsBlocks) {
        const newsBlock = newsMatch[1] ?? '';
        const t = cleanNewsTitle(
          newsBlock.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] ?? ''
        );
        const u = decodeXmlEntities(
          newsBlock.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1] ?? ''
        );
        if (t) extractedNews.push({ title: t, url: u });
      }
      // <ht:news_item> 래퍼 없이 태그만 있는 간단한 RSS(테스트 픽스처 등)도 호환한다.
      if (extractedNews.length === 0) {
        const t = cleanNewsTitle(
          block.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1] ?? ''
        );
        const u = decodeXmlEntities(
          block.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1] ?? ''
        );
        if (t) extractedNews.push({ title: t, url: u });
      }

      const koreanFirst = extractedNews.find((entry) => hasKorean(entry.title)) ?? extractedNews[0];
      const primaryHeadline = (koreanFirst?.title || cleanTitle).slice(0, 180);
      if (!hasKorean(primaryHeadline) && !hasKorean(cleanTitle)) continue;

      const subHeadlines = extractedNews
        .map((entry) => entry.title.slice(0, 140))
        .filter((title) => title !== primaryHeadline && hasKorean(title))
        .slice(0, 2);

      out.push({
        keyword: cleanTitle.slice(0, 24),
        headline: primaryHeadline,
        url: koreanFirst?.url ?? '',
        ...(subHeadlines.length > 0 && { subHeadlines }),
      });
    } else {
      if (!hasKorean(cleanTitle)) continue;
      const link = decodeXmlEntities(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '');
      const shortKey = extractGoogleNewsKeyword(cleanTitle);
      if (!shortKey) continue;
      out.push({
        keyword: shortKey,
        headline: cleanTitle.slice(0, 180),
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

/** LLM 쿼터 소진/타임아웃 시에도 RSS만으로 자연스러운 토론 주제를 만드는 결정론적 변환기. */
export function buildDeterministicTopics(candidates: RawCandidate[]): TrendTopicItem[] {
  const suffixes = [
    '이 얘기 어떻게 생각해?',
    '다들 이거 어떻게 봐?',
    '주변에서도 이런 얘기 나와?',
    '너라면 어떻게 할 것 같아?',
  ];

  return candidates.slice(0, 10).map((c, idx) => {
    const k = c.keyword.slice(0, 12).trim();
    const headline = c.headline
      .replace(/\s+/g, ' ')
      .replace(/[.…]+$/g, '')
      .trim()
      .slice(0, 175);
    const suffix = suffixes[idx % suffixes.length] ?? '이 얘기 어떻게 생각해?';
    const endsWithQuestion = headline.endsWith('?');
    const topic = (endsWithQuestion ? headline : `${headline}. ${suffix}`).slice(0, 240);
    const related = c.subHeadlines?.[0]?.trim();
    const context = related
      ? related.slice(0, 100)
      : `실시간 화제 키워드 '${k}' 관련 보도 내용을 바탕으로 얘기해 보자.`;
    return {
      keyword: k,
      topic,
      context,
    };
  });
}

export class TrendsService {
  private cache: TrendsPayload | null = null;
  private lastFetchTime = 0;
  private inFlight: Promise<TrendsPayload> | null = null;
  private upgradeInFlight: Promise<void> | null = null;

  private isCacheFresh(now: number): boolean {
    if (!this.cache) return false;
    const ttl = this.cache.source === 'rss+llm' ? CACHE_TTL_MS : FALLBACK_CACHE_TTL_MS;
    return now - this.lastFetchTime < ttl;
  }

  async getTrends(): Promise<TrendsPayload> {
    const now = Date.now();
    if (this.isCacheFresh(now) && this.cache) {
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

  private async runCurateCall(
    candidates: RawCandidate[],
    excludes: Set<string> = new Set()
  ): Promise<TrendTopicItem[] | null> {
    const numbered = candidates
      .slice(0, 12)
      .map((c, i) => {
        const extra = c.subHeadlines?.[0] ? ` / 관련: ${c.subHeadlines[0]}` : '';
        return `${i + 1}. [${c.keyword}] ${c.headline}${extra}`;
      })
      .join('\n');
    const avoidLine =
      excludes.size > 0
        ? `\n이미 토론한 주제 ${[...excludes].slice(0, 20).join(', ')}와 같은 화제는 절대 다시 고르지 마라.`
        : '';

    try {
      const result = await proxyService.chat(
        {
          messages: [
            {
              role: 'system',
              content: `너는 귀여운 아기 동물 설원 수다방의 화제 큐레이터다. 오늘의 한국 뉴스 목록에서 사건·사고·범죄·정치 갈등·부고·사적 가십은 모두 버리고, 음식·일상·소비·문화·영화·음악·게임·IT·스포츠·계절 유행 중 이야기 나눌 만한 화제 5~6개를 골라 JSON 배열로만 출력해라.

규칙:
- keyword: 핵심 주제어 2~12자
- topic: 무슨 일인지 배경 1문장 + 친구에게 묻는 자연스러운 찬반·취향·경험 질문 1문장(80~135자, 최대 160자. 반드시 '?'로 끝낼 것). "~여부 논의", "~이유 분석" 같은 보고서 말투 금지.
- context: topic과 겹치지 않는 원인·수치·관전 포인트 1줄(25~55자, 최대 80자).
- 반드시 100% 한국어만 사용(불필요한 영단어 금지, AI·IT·OTT·SSD 같은 일상 약어만 허용).
- 마크다운 코드블록 없이 순수 JSON 배열만 출력해라.

예시:
[{"keyword":"스마트폰 가격","topic":"삼성·애플 신형폰 할인 혜택이 줄면서 20만원 예상하고 매장 갔다가 훨씬 비싸져 당황한 사람들이 많대. 폰 바꿀 때 최신형 고집해, 아니면 가성비 모델로 타협해?","context":"메모리 가격 상승과 공시지원금 축소가 겹친 여파"}]${avoidLine}`,
            },
            {
              role: 'user',
              content: numbered,
            },
          ],
          temperature: 0.5,
          max_tokens: 6000,
          reasoning_effort: 'none',
          stream: false,
        },
        undefined,
        { textOnlyModels: true, preferFastNonReasoning: true }
      );

      if ('error' in result) return null;
      const raw = String(result.choices?.[0]?.message?.content ?? '');
      const entries = parseCuratedArray(raw);
      if (!entries) return null;

      const items: TrendTopicItem[] = [];
      for (const entry of entries) {
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
    }
  }

  private async curateWithLLM(
    candidates: RawCandidate[],
    excludes: Set<string> = new Set(),
    onBackgroundUpgrade?: (items: TrendTopicItem[]) => void
  ): Promise<TrendTopicItem[] | null> {
    const llmPromise = this.runCurateCall(candidates, excludes);
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        resolve(null);
      }, LLM_CURATE_WAIT_MS);
    });

    try {
      const winner = await Promise.race([llmPromise, timeoutPromise]);
      if (timedOut && onBackgroundUpgrade && !this.upgradeInFlight) {
        // 시간 초과로 RSS를 먼저 내려주더라도, 이미 시작한 LLM 응답이 도착하면 캐시를 rss+llm으로 승격한다.
        this.upgradeInFlight = llmPromise
          .then((lateItems) => {
            if (lateItems && lateItems.length >= 3) {
              onBackgroundUpgrade(lateItems);
            }
          })
          .catch(() => {})
          .finally(() => {
            this.upgradeInFlight = null;
          });
      }
      return winner;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
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

    const curated = await this.curateWithLLM(safe, new Set(), (lateItems) => {
      this.cache = {
        items: lateItems,
        updatedAt: new Date().toISOString(),
        source: 'rss+llm',
      };
      this.lastFetchTime = Date.now();
    });
    const payload: TrendsPayload = curated
      ? { items: curated, updatedAt, source: 'rss+llm' }
      : { items: buildDeterministicTopics(safe), updatedAt, source: 'rss' };

    this.cache = payload;
    this.lastFetchTime = Date.now();
    return payload;
  }
}

export const trendsService = new TrendsService();
