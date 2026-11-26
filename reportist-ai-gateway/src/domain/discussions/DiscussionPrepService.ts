// DiscussionPrepService.ts - 토론 주제에 대한 공통 배경 자료 조사·캐시 서비스
//
// 게이트웨이에서만 뉴스 검색을 수행해 검색 키·출처를 브라우저에 노출하지 않는다.
// 모든 동물이 같은 자료를 공유하도록 주제별로 30분 캐시한다.

import { proxyService } from '../proxy/ProxyService.ts';
import {
  filterSafeCandidates,
  isSafeTopicText,
  parseRssCandidates,
} from '../trends/TrendsService.ts';

export interface DiscussionFact {
  claim: string;
  source: string;
  url?: string;
}

export interface DiscussionBriefing {
  background: string;
  facts: DiscussionFact[];
  questions: string[];
  /** 출처가 헤드라인 수준이거나 확인이 부족할 때 표시한다. */
  limitation?: string;
}

export interface DiscussionPrepPayload {
  topic: string;
  briefing: DiscussionBriefing;
  source: 'rss+llm' | 'rss' | 'fallback';
  preparedAt: string;
}

interface CacheEntry {
  payload: DiscussionPrepPayload;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 5000;
const LLM_TIMEOUT_MS = 25_000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function normalizeTopic(topic: string): string {
  return topic.toLowerCase().replace(/\s+/g, '').slice(0, 80);
}

function trim(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

export class DiscussionPrepService {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<DiscussionPrepPayload>>();

  async prepare(topic: string, context?: string): Promise<DiscussionPrepPayload> {
    const key = normalizeTopic(topic);
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.payload;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const task = this.refresh(topic, context)
      .then((payload) => {
        this.cache.set(key, { payload, fetchedAt: Date.now() });
        return payload;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, task);
    return task;
  }

  /** 주제로 뉴스 검색을 수행해 출처 후보를 모은다. 실패하면 빈 배열. */
  private async searchNews(topic: string): Promise<ReturnType<typeof filterSafeCandidates>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    try {
      const query = encodeURIComponent(
        topic
          .replace(/[?~…!]/g, ' ')
          .trim()
          .slice(0, 60)
      );
      const url = `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: controller.signal,
      });
      if (!response.ok) return [];
      const xml = await response.text();
      return filterSafeCandidates(parseRssCandidates(xml, 'google-news')).slice(0, 5);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /** 검색 결과와 RSS 문맥을 근거로 배경·사실·쟁점을 정리한다. 근거 없이 단정하지 않는다. */
  private async curate(
    topic: string,
    context: string | undefined,
    sources: ReturnType<typeof filterSafeCandidates>
  ): Promise<DiscussionBriefing | null> {
    const numbered = sources
      .map((item, index) => `${index + 1}. [${item.keyword}] ${item.headline}\n   ${item.url}`)
      .join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const result = await Promise.race([
        proxyService.chat(
          {
            messages: [
              {
                role: 'system',
                content:
                  '너는 아기 동물 토론방의 자료 조사원이다. 주제와 아래 검색 결과만 근거로 삼아 ' +
                  '순수 JSON 객체 하나만 출력한다. 형식: {"background":"주제 배경 2~3문장",' +
                  '"facts":[{"claim":"확인된 사실 한 줄","source":"출처명","url":"링크"}],' +
                  '"questions":["토론할 쟁점 질문","토론할 쟁점 질문"],' +
                  '"limitation":"확인하지 못한 부분이나 주의점(없으면 빈 문자열)"}。' +
                  '검색 결과에 없는 날짜·수치·인물은 만들지 말고, 불확실하면 limitation에 적어라. ' +
                  'facts는 최대 4개, questions는 최대 3개. 마크다운 코드블록 없이 JSON만 출력해라.',
              },
              {
                role: 'user',
                content: `토론 주제: ${topic}\n화제 배경: ${context ?? '(없음)'}\n\n검색 결과:\n${numbered || '(검색 결과 없음)'}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 700,
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
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end <= start) return null;
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

      const background = trim(parsed.background, 320);
      if (background.length < 8) return null;

      const facts: DiscussionFact[] = [];
      if (Array.isArray(parsed.facts)) {
        for (const entry of parsed.facts.slice(0, 4)) {
          if (!entry || typeof entry !== 'object') continue;
          const rec = entry as Record<string, unknown>;
          const claim = trim(rec.claim, 140);
          if (claim.length < 4) continue;
          const source = trim(rec.source, 40) || '검색 결과';
          const url = trim(rec.url, 300);
          const allowed = sources.some((s) => url.length > 0 && s.url === url);
          facts.push({
            claim,
            source,
            ...(allowed && { url }),
          });
        }
      }

      const questions: string[] = [];
      if (Array.isArray(parsed.questions)) {
        for (const entry of parsed.questions.slice(0, 3)) {
          const question = trim(entry, 100);
          if (question.length >= 4) questions.push(question);
        }
      }

      return {
        background,
        facts,
        questions,
        limitation: trim(parsed.limitation, 160),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** LLM 실패 시 검색 결과만으로 만드는 안전한 최소 자료. */
  private deterministic(
    topic: string,
    context: string | undefined,
    sources: ReturnType<typeof filterSafeCandidates>
  ): DiscussionBriefing {
    const facts: DiscussionFact[] = sources.slice(0, 4).map((item) => ({
      claim: item.headline.slice(0, 120),
      source: 'Google News 검색',
      url: item.url,
    }));
    return {
      background: context
        ? `${context}. 아래 보도에서 확인되는 내용을 바탕으로 이야기해보자.`
        : `'${topic}'에 대해 아래 보도들이 확인된다.`,
      facts,
      questions: [`${topic}에서 제일 중요한 쟁점은 뭐일까?`, '이 내용을 어떻게 받아들이면 좋을까?'],
      limitation:
        facts.length === 0
          ? '검색 결과가 없어 확인된 근거가 없어요.'
          : '헤드라인 수준의 정보라 본문 확인이 필요해요.',
    };
  }

  private async refresh(topic: string, context?: string): Promise<DiscussionPrepPayload> {
    const sources = isSafeTopicText(topic) ? await this.searchNews(topic) : [];
    const curated =
      sources.length > 0 || context ? await this.curate(topic, context, sources) : null;
    const briefing = curated ?? this.deterministic(topic, context, sources);
    return {
      topic,
      briefing,
      source: curated ? 'rss+llm' : sources.length > 0 || context ? 'rss' : 'fallback',
      preparedAt: new Date().toISOString(),
    };
  }
}

export const discussionPrepService = new DiscussionPrepService();
