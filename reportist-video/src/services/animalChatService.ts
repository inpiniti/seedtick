import {
  ANIMAL_MBTI,
  ANIMAL_SPECIES,
  type AnimalSpecies,
} from '../components/studio-v2/penguin-stage/species.ts';
import { DEFAULT_CONFIG } from './gatewayClient.ts';

/** /v1/trends가 내려주는 동물 대사 한 줄. */
export interface TrendScriptLine {
  speaker: AnimalSpecies;
  mbti: string;
  text: string;
}

/** 배경 스테이지가 재생할 토론 대본. */
export interface DiscussionScript {
  topic: string;
  context?: string;
  lines: TrendScriptLine[];
}

/** 게이트웨이가 dead 상태일 때 쓰는 설원 토론 주제. */
const FALLBACK_TOPICS = [
  '요즘 다들 뭐에 열광하는 거야?',
  '오늘 사람들이 제일 많이 한 말은 뭐야?',
  '최근 화제인 겨울 놀이 뭐야?',
  '지금 가장 기대되는 건 뭐야?',
  '요즘 유행하는 말 있어?',
  '오늘 기분은 어때?',
  '설원에서 제일 재밌는 건 뭐야?',
  '누가 제일 멋져 보일까?',
  '겨울에 하고 싶은 건 뭐야?',
  '같이 놀 친구는 누가 좋을까?',
  '설원에서 가장 멀리 걷고 싶은 사람?',
];

/** 각 동물의 말투를 살린 로컬 대사 템플릿. {k}는 화제 핵심어로 치환한다. */
const LOCAL_LINE_TEMPLATES: Record<AnimalSpecies, readonly string[]> = {
  penguin: ['다들 {k} 어때? 내가 먼저 꺼낼게!', '너희 생각이 제일 궁금해, {k}?'],
  cat: ['{k}? 음, 원리가 궁금하네.', '그 {k} 말인데, 근거가 뭐야?'],
  dog: ['{k} 완전 신나! 같이 하자!', '와 {k} 재밌겠다 나도 할래!'],
  rabbit: ['{k} 요즘 제일 핫하지!', '이번 {k}는 진짜 트렌드야~'],
  bear: ['{k} 듣자니 편하네~', '천천히 {k} 같이 즐기자.'],
  fox: ['{k}? 진짜? 나는 반대!', '그 {k}, 다른 얘기도 있지 않아?'],
  panda: ['{k}… 느긋하게 생각 중~', '음 {k} 좋다, 누워서 할래.'],
  koala: ['{k}? 나는 패스, 좀 귀찮아.', '그냥 {k} 넘기자, 에너지 아껴.'],
  squirrel: ['{k} 준비물부터 챙기자!', '{k} 가성비 따져보고 갈래.'],
  raccoon: ['{k} 일단 내가 해볼게!', '고민 말고 {k} 바로 해보자!'],
  'polar-bear': ['{k} 속에 뭐가 있을까?', '{k}, 오래 두고 생각해볼게.'],
  owl: ['{k} 결론은 이거야.', '{k} 흐름을 보면 다 보이네.'],
};

function cleanLine(raw: string): string {
  return raw
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([?!.,~])\1+/g, '$1')
    .trim()
    .slice(0, 42);
}

/** 모델이 대사 대신 설명을 내놓을 때를 걸러낸다. */
function isValidLine(text: string): boolean {
  if (text.length < 2 || text.length > 42) return false;
  // 순수 영어 응답은 차단하되 MBTI·OTT·ChatGPT 같은 짧은 약어는 허용한다.
  if ((text.match(/[가-힣]/g)?.length ?? 0) < 2) return false;
  if ((text.match(/[A-Za-z]/g)?.length ?? 0) > 10) return false;
  if (/(user|assistant|system|thinking|sure,|here is|act as|prompt|프롬프트|대사만)/i.test(text)) {
    return false;
  }
  return true;
}

/** 네트워크 없이도 즉시 재생할 수 있는 MBTI 대본. */
export function getLocalScript(now: number): DiscussionScript {
  const topic = FALLBACK_TOPICS[Math.floor(now / 22000) % FALLBACK_TOPICS.length] ?? '';
  const keyword = topic.replace(/[?~…!]/g, '').slice(0, 8);
  const start = Math.floor(now / 4200) % ANIMAL_SPECIES.length;

  const lines: TrendScriptLine[] = [];
  for (let i = 0; i < 8; i++) {
    const species = ANIMAL_SPECIES[(start + i) % ANIMAL_SPECIES.length];
    if (!species) continue;
    const templates = LOCAL_LINE_TEMPLATES[species];
    const template = templates[(start + i) % templates.length] ?? templates[0];
    const text = cleanLine((template ?? '').replace('{k}', keyword));
    lines.push({
      speaker: species,
      mbti: ANIMAL_MBTI[species],
      text: isValidLine(text) ? text : `${keyword} 어때?`,
    });
  }
  return { topic, lines };
}

const TREND_CLIENT_TTL_MS = 15 * 60 * 1000;
const TREND_FETCH_TIMEOUT_MS = 15_000;
let cachedScripts: DiscussionScript[] = [];
let trendPoolFetchedAt = 0;
let trendCursor = 0;
let trendFetchPromise: Promise<DiscussionScript[]> | null = null;

function fetchWithTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  // fetch 완료 후 timer를 정리하기 위해 signal에 표시한다.
  (controller as AbortController & { __clearTimer?: () => void }).__clearTimer = () => {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  };
  return controller.signal;
}

function cleanupFetchSignal(signal: AbortSignal): void {
  const clear = (signal as AbortSignal & { __clearTimer?: () => void }).__clearTimer;
  clear?.();
}

async function loadScriptPool(signal?: AbortSignal): Promise<DiscussionScript[]> {
  if (trendFetchPromise) return trendFetchPromise;
  const base = DEFAULT_CONFIG.baseUrl.replace(/\/$/, '');
  const controller = fetchWithTimeout(TREND_FETCH_TIMEOUT_MS, signal);
  trendFetchPromise = (async (): Promise<DiscussionScript[]> => {
    try {
      const response = await fetch(`${base}/v1/trends`, {
        headers: { Accept: 'application/json' },
        signal: controller,
      });
      if (!response.ok) return [];

      const payload = (await response.json()) as {
        items?: Array<{
          topic?: string;
          context?: string;
          lines?: Array<{ speaker?: string; mbti?: string; text?: string }>;
        }>;
      };
      const scripts: DiscussionScript[] = [];
      for (const item of payload.items ?? []) {
        if (typeof item?.topic !== 'string' || item.topic.trim().length < 4) continue;
        const lines: TrendScriptLine[] = [];
        for (const raw of item.lines ?? []) {
          const speaker = ANIMAL_SPECIES.find((s) => s === raw?.speaker);
          const text = cleanLine(typeof raw?.text === 'string' ? raw.text : '');
          if (!speaker || !isValidLine(text)) continue;
          // MBTI는 로컬 배정표를 기준으로 덮어써서 모델 환각을 막는다.
          lines.push({ speaker, mbti: ANIMAL_MBTI[speaker], text });
        }
        if (lines.length < 3) continue;
        scripts.push({
          topic: item.topic.trim().slice(0, 42),
          context:
            typeof item.context === 'string' ? item.context.trim().slice(0, 80) : undefined,
          lines: lines.slice(0, 8),
        });
      }
      if (scripts.length === 0) return [];

      cachedScripts = scripts;
      trendPoolFetchedAt = performance.now();
      trendCursor = 0;
      return scripts;
    } catch {
      return [];
    } finally {
      cleanupFetchSignal(controller);
      trendFetchPromise = null;
    }
  })();
  return trendFetchPromise;
}

/** /v1/trends 캐시 풀에서 다음 대본을 순환 반환. 실패·오프라인 시 로컬 MBTI 대본. */
export async function requestDiscussionScript(signal?: AbortSignal): Promise<DiscussionScript> {
  if (
    cachedScripts.length > 0 &&
    performance.now() - trendPoolFetchedAt < TREND_CLIENT_TTL_MS
  ) {
    const script = cachedScripts[trendCursor % cachedScripts.length];
    trendCursor += 1;
    if (script) return script;
  }
  const pool = await loadScriptPool(signal);
  if (pool.length > 0) {
    const script = pool[trendCursor % pool.length] ?? pool[0];
    trendCursor += 1;
    if (script) return script;
  }
  return getLocalScript(performance.now());
}
