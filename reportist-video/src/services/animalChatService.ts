import {
  ANIMAL_LABELS,
  ANIMAL_MBTI,
  ANIMAL_PERSONAS,
  type AnimalSpecies,
} from '../components/studio-v2/penguin-stage/species.ts';
import { DEFAULT_CONFIG } from './gatewayClient.ts';

/** 말풍선에 들어갈 내용. 전체 텍스트이며 화면에서는 잘려 보일 수 있다. */
export interface AnimalSpeech {
  text: string;
}

/** 토론에 참여한 한 마리의 발언. */
export interface DiscussionEntry {
  speaker: AnimalSpecies;
  text: string;
}

/** 게이트웨이 /v1/trends가 내려주는 토론 주제 정보. */
export interface DiscussionTopicInfo {
  topic: string;
  keyword?: string;
  context?: string;
}

/** 게이트웨이 /v1/discussions/prepare가 내려주는 공통 조사 자료. */
export interface DiscussionFact {
  claim: string;
  source: string;
  url?: string;
}

export interface DiscussionBriefing {
  background: string;
  facts: DiscussionFact[];
  questions: string[];
  limitation?: string;
}

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

/** LLM 실패 시 종별로 돌려쓰는 MBTI 말투 대사. 한 줄이라도 생각이 담기게 썼다. */
const FALLBACK_LINES: Record<AnimalSpecies, readonly string[]> = {
  penguin: [
    '일단 내가 궁금한 건 왜 이런 얘기가 나왔는지야. 같이 정리해보자.',
    '그 말 재밌는데, 그럼 반대 의견은 뭐가 있을까?',
    '다들 이야기해줘서 좋다. 조금 더 생각해보자.',
  ],
  cat: [
    '그건 근거가 뭔데? 나는 팩트부터 확인하고 싶다.',
    '아까 말한 거랑 지금 말한 거 좀 다르지 않나?',
    '호기심이 생겼어. 조금 더 파봐야겠다.',
  ],
  dog: [
    '와 재밌겠다! 나도 같이 해보고 싶어!',
    '좋아, 그럼 우리 직접 해보자! 뭐가 제일 신나?',
    '다들 최고야! 근데 다음엔 뭐 해볼까?',
  ],
  rabbit: [
    '이거 요즘 진짜 핫하지! 나 제일 먼저 알았어~',
    '그럼 이건 어때? 나는 좀 다르게 보고 있어.',
    '유행은 금방 바뀌는데 왜 이게 오래 남을까?',
  ],
  bear: [
    '음~ 천천히 생각해보자. 급하지 않아.',
    '나는 편한 게 제일 좋아. 근데 그게 맞을까?',
    '따뜻하게 이야기하니까 좋네. 더 들어볼게.',
  ],
  fox: [
    '진짜? 나는 반대! 그렇게 보지 않아.',
    '색다른 생각이 필요하지~ 아까 얘긴 좀 약해.',
    '내가 한 수 가르쳐줄게. 이렇게도 볼 수 있어.',
  ],
  panda: [
    '음… 누워서 생각 중이야. 평화로워서 좋다.',
    '그 얘기 들으니까 나도 좀 해보고 싶어.',
    '느긋하게 하자~ 근데 결론은 뭐가 좋을까?',
  ],
  koala: [
    '나는 패스, 귀찮아. 근데 한 가지는 말할게.',
    '에너지 아끼자. 짧게 말하면 이거야.',
    '그냥 넘기자. 근데 아까 말은 기억할게.',
  ],
  squirrel: [
    '준비물부터 챙기자! 가성비 따져봐야지.',
    '계획 세웠어? 그럼 이건 어떻게 될까?',
    '이거 저장해둘게. 나중에 다시 보자.',
  ],
  raccoon: [
    '일단 내가 해볼게! 고민 말고 바로 해보자.',
    '이거 내가 찾았어. 직접 해보면 알지!',
    '호기심이 못 참겠어. 다음엔 뭐 해볼까?',
  ],
  'polar-bear': [
    '오래 두고 생각해볼게. 속에 뭐가 있을까?',
    '차분히 얘기하자. 설원이 조용해서 좋다.',
    '깊이 있는 얘기네. 나도 한 마디 보탤게.',
  ],
  owl: [
    '결론은 이거야. 흐름을 보면 다 보여.',
    '한 번 더 따져보자. 아까 그 말엔 구멍이 있어.',
    '정리하면 됐어. 쟁점은 세 가지야.',
  ],
  deer: [
    '음… 저기 뭐가 있네?',
    '살짝 구경만 할게.',
    '조용히 듣고 있을게.',
    '뿔이 살짝 간지럽다.',
    '천천히 가도 될까?',
  ],
  elephant: [
    '그거 기억나는데~',
    '예전에도 그랬지.',
    '코로 살짝 담아둘게.',
    '다들 잘하고 있어.',
    '천천히 가자, 괜찮아.',
  ],
  hedgehog: [
    '잠깐, 가시가 서겠네.',
    '조심해서 가야지.',
    '한 가지만 더 따져보자.',
    '나는 좀 신중한 편이야.',
    '천천히 하면 괜찮아.',
  ],
  frog: [
    '개굴! 뭐해뜨?',
    '나도 같이 뛰자!',
    '이거 완전 재밌다~',
    '툭 던져볼게!',
    '분위기 살려볼게~',
  ],
};

export function getFallbackLine(species: AnimalSpecies, seed: number): string {
  const lines = FALLBACK_LINES[species];
  return lines[Math.abs(Math.floor(seed)) % lines.length] ?? lines[0] ?? '그렇구나!';
}

const TREND_CLIENT_TTL_MS = 15 * 60 * 1000;
const TREND_FETCH_TIMEOUT_MS = 18_000;
let cachedTopics: DiscussionTopicInfo[] = [];
let trendPoolFetchedAt = 0;
let trendCursor = 0;
let trendFetchPromise: Promise<DiscussionTopicInfo[]> | null = null;
/** exclude 갱신 요청은 키별로 in-flight를 공유해 동시에 여러 펭귄이 같은 배치를 다시 받지 않게 한다. */
const trendRefreshInFlight = new Map<string, Promise<DiscussionTopicInfo[]>>();

/** 이미 토론에 내보낸 주제. 같은 trends 주제가 다시 나오지 않도록 건너뛴다. */
const discussedTopicKeys = new Set<string>();
/** 게이트웨이 exclude 파라미터로 보낼 원문 키워드(최근 순). */
const discussedLabels: string[] = [];

function topicKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s,.!?…·'"“”‘’()[\]]/g, '');
}

function isDiscussed(item: DiscussionTopicInfo): boolean {
  return (
    discussedTopicKeys.has(topicKey(item.topic)) ||
    Boolean(item.keyword && discussedTopicKeys.has(topicKey(item.keyword)))
  );
}

/** 주제를 토론 완료로 표시한다. 다음 요청부터는 이 주제를 건너뛴다. */
export function markTopicDiscussed(topic: string, keyword?: string): void {
  for (const value of [topic, keyword]) {
    const key = value ? topicKey(value) : '';
    if (key) discussedTopicKeys.add(key);
  }
  const label = (keyword ?? topic).replace(/,/g, ' ').trim();
  if (label && !discussedLabels.includes(label)) {
    discussedLabels.push(label);
    if (discussedLabels.length > 40) discussedLabels.shift();
  }
}

function resetDiscussedTopics(): void {
  discussedTopicKeys.clear();
  discussedLabels.length = 0;
}

/** 커서부터 시작해 아직 토론하지 않은 주제를 고른다. */
function pickUnusedTopic(
  items: DiscussionTopicInfo[],
  resetWhenExhausted = false
): DiscussionTopicInfo | null {
  if (items.length === 0) return null;
  const start = ((trendCursor % items.length) + items.length) % items.length;
  for (let offset = 0; offset < items.length; offset += 1) {
    const item = items[(start + offset) % items.length];
    if (item && !isDiscussed(item)) {
      trendCursor = start + offset + 1;
      return item;
    }
  }
  if (!resetWhenExhausted) return null;
  // 로컬 폴백 주제도 전부 사용했다면 새 순환을 시작한다.
  resetDiscussedTopics();
  const item = items[start];
  trendCursor = start + 1;
  return item ?? null;
}

function fetchWithTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
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

/** exclude가 있으면 캐시를 우회해 겹치지 않는 새 배치를 받는다. */
async function loadTrendPool(
  signal?: AbortSignal,
  exclude: string[] = []
): Promise<DiscussionTopicInfo[]> {
  const isRefresh = exclude.length > 0;
  const refreshKey = isRefresh ? exclude.join('|') : '';
  if (isRefresh) {
    const pending = trendRefreshInFlight.get(refreshKey);
    if (pending) return pending;
  } else if (trendFetchPromise) {
    return trendFetchPromise;
  }
  const base = DEFAULT_CONFIG.baseUrl.replace(/\/$/, '');
  const url = isRefresh
    ? `${base}/v1/trends?exclude=${encodeURIComponent(exclude.join(','))}`
    : `${base}/v1/trends`;
  const controller = fetchWithTimeout(TREND_FETCH_TIMEOUT_MS, signal);
  const task = (async (): Promise<DiscussionTopicInfo[]> => {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller,
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        items?: Array<{ topic?: string; keyword?: string; context?: string }>;
      };
      const items = (payload.items ?? [])
        .map((item) => ({
          topic: typeof item?.topic === 'string' ? item.topic.trim().slice(0, 240) : '',
          keyword:
            typeof item?.keyword === 'string' ? item.keyword.trim().slice(0, 16) : undefined,
          context:
            typeof item?.context === 'string' ? item.context.trim().slice(0, 120) : undefined,
        }))
        .filter((item) => item.topic.length >= 4 && !isDiscussed(item));
      if (items.length === 0) return [];

      cachedTopics = items;
      trendPoolFetchedAt = performance.now();
      trendCursor = 0;
      return items;
    } catch {
      return [];
    } finally {
      cleanupFetchSignal(controller);
      if (isRefresh) trendRefreshInFlight.delete(refreshKey);
      else trendFetchPromise = null;
    }
  })();
  if (isRefresh) trendRefreshInFlight.set(refreshKey, task);
  else trendFetchPromise = task;
  return task;
}

/** 게이트웨이 /v1/trends에서 안 토론한 주제를 반환한다. 한 배치를 다 쓰면 겹치지 않는 새 배치를 받는다. */
export async function requestDiscussionTopic(signal?: AbortSignal): Promise<DiscussionTopicInfo> {
  if (
    cachedTopics.length > 0 &&
    performance.now() - trendPoolFetchedAt < TREND_CLIENT_TTL_MS
  ) {
    const item = pickUnusedTopic(cachedTopics);
    if (item) {
      markTopicDiscussed(item.topic, item.keyword);
      return item;
    }
  }

  // 현재 배치를 전부 토론했다면 이미 다룬 주제를 제외한 새 배치를 요청한다.
  const refreshed = await loadTrendPool(signal, discussedLabels.slice(-20));
  const refreshedItem = refreshed.length > 0 ? pickUnusedTopic(refreshed) : null;
  if (refreshedItem) {
    markTopicDiscussed(refreshedItem.topic, refreshedItem.keyword);
    return refreshedItem;
  }

  // 갱신 실패 시 게이트웨이 기본 풀을 한 번 더 확인한다.
  const pool = await loadTrendPool(signal);
  const poolItem = pool.length > 0 ? pickUnusedTopic(pool) : null;
  if (poolItem) {
    markTopicDiscussed(poolItem.topic, poolItem.keyword);
    return poolItem;
  }

  // 게이트웨이가 새 주제를 주지 못하면 로컬 주제로 대화를 이어간다.
  const fallbackPool: DiscussionTopicInfo[] = FALLBACK_TOPICS.map((topic) => ({ topic }));
  const fallback =
    pickUnusedTopic(fallbackPool, true) ?? { topic: FALLBACK_TOPICS[0] ?? '다음 이야기 뭐 할까?' };
  markTopicDiscussed(fallback.topic);
  return fallback;
}

const BRIEFING_CLIENT_TTL_MS = 30 * 60 * 1000;
const BRIEFING_TIMEOUT_MS = 32_000;
const briefingCache = new Map<string, { briefing: DiscussionBriefing; fetchedAt: number }>();
const briefingInFlight = new Map<string, Promise<DiscussionBriefing | null>>();

/** 주제가 정해질 때 한 번만 조사 자료를 받아 모든 발언에 공유한다. */
export async function requestDiscussionBriefing(
  topic: string,
  context: string | undefined,
  signal?: AbortSignal,
  keyword?: string
): Promise<DiscussionBriefing | null> {
  const key = topic.trim().toLowerCase().slice(0, 240);
  const hit = briefingCache.get(key);
  if (hit && performance.now() - hit.fetchedAt < BRIEFING_CLIENT_TTL_MS) return hit.briefing;

  const pending = briefingInFlight.get(key);
  if (pending) return pending;

  const base = DEFAULT_CONFIG.baseUrl.replace(/\/$/, '');
  const controller = fetchWithTimeout(BRIEFING_TIMEOUT_MS, signal);
  const task = (async (): Promise<DiscussionBriefing | null> => {
    try {
      const response = await fetch(`${base}/v1/discussions/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEFAULT_CONFIG.gatewaySecret}`,
        },
        body: JSON.stringify({ topic, context, keyword }),
        signal: controller,
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as { briefing?: DiscussionBriefing };
      const briefing = payload.briefing;
      if (!briefing || typeof briefing.background !== 'string') return null;
      const normalized: DiscussionBriefing = {
        background: briefing.background.slice(0, 320),
        facts: Array.isArray(briefing.facts)
          ? briefing.facts.slice(0, 4).filter((f) => typeof f?.claim === 'string')
          : [],
        questions: Array.isArray(briefing.questions)
          ? briefing.questions.slice(0, 3).filter((q): q is string => typeof q === 'string')
          : [],
        limitation: typeof briefing.limitation === 'string' ? briefing.limitation.slice(0, 160) : undefined,
      };
      briefingCache.set(key, { briefing: normalized, fetchedAt: performance.now() });
      return normalized;
    } catch {
      return null;
    } finally {
      cleanupFetchSignal(controller);
      briefingInFlight.delete(key);
    }
  })();
  briefingInFlight.set(key, task);
  return task;
}

const CHAT_TIMEOUT_MS = 15_000;
/** 연속 실패 시 짧게 로컬 대사만 사용해 실패한 게이트웨이로 폭주하지 않는다. */
const LOCAL_FALLBACK_COOLDOWN_MS = 30_000;
let consecutiveFailures = 0;
let localFallbackUntil = 0;

function cleanLine(raw: string): string {
  return raw
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .replace(/([?!.,~])\1+/g, '$1')
    .trim()
    .slice(0, 110);
}

/** 모델이 대사 대신 설명을 내놓을 때를 걸러낸다. */
function isValidLine(text: string): boolean {
  if (text.length < 12 || text.length > 110) return false;
  if ((text.match(/[가-힣]/g)?.length ?? 0) < 5) return false;
  if ((text.match(/[A-Za-z]/g)?.length ?? 0) > 14) return false;
  if (/(user|assistant|system|thinking|sure,|here is|act as|prompt|프롬프트|대사만|JSON)/i.test(text)) {
    return false;
  }
  return true;
}

function turnHint(turnIndex: number): string {
  if (turnIndex < 2) return '첫인상을 말하거나 아직 확인되지 않은 부분을 물어봐.';
  if (turnIndex < 5) return '아까 나온 말을 근거로 삼거나, 배경·원인을 확인하는 질문을 해.';
  if (turnIndex < 9) return '내 생각과 이유를 구체적으로 말하고, 다른 의견도 함께 언급해.';
  if (turnIndex < 14) return '앞선 의견에 반박하거나 예외를 들어 더 깊이 파고들어.';
  return '지금까지 나온 의견을 정리하고 남은 쟁점을 짚어줘.';
}

/** 매 턴 /v1/chat/completions로 조사 자료를 반영한 한 발언을 받는다. */
export async function requestAnimalLine(params: {
  speaker: AnimalSpecies;
  listener: AnimalSpecies;
  previousText?: string;
  previousSpeaker?: AnimalSpecies;
  topic?: string;
  topicContext?: string;
  briefing?: DiscussionBriefing;
  turnIndex?: number;
  history?: DiscussionEntry[];
  signal?: AbortSignal;
}): Promise<AnimalSpeech> {
  const {
    speaker,
    listener,
    previousText,
    previousSpeaker,
    topic,
    topicContext,
    briefing,
    turnIndex = 0,
    history,
    signal,
  } = params;
  const now = performance.now();
  const fallback = (): AnimalSpeech => ({
    text: getFallbackLine(speaker, Math.floor(now / 1500) + (history?.length ?? 0)),
  });

  if (signal?.aborted || now < localFallbackUntil) return fallback();

  // 모델은 지정하지 않는다. 게이트웨이가 현재 차단되지 않은 텍스트 모델을 골라
  // 실패하면 다음 모델로 넘어가며, 클라이언트는 그 결과만 받는다.
  const speakerLabel = ANIMAL_LABELS[speaker];
  const listenerLabel = ANIMAL_LABELS[listener];
  const persona = ANIMAL_PERSONAS[speaker];
  const transcript = (history ?? [])
    .slice(-6)
    .map((entry) => `${ANIMAL_LABELS[entry.speaker]}: ${entry.text}`)
    .join('\n');

  const briefingLines: string[] = [];
  if (briefing) {
    briefingLines.push(`배경: ${briefing.background}`);
    for (const fact of briefing.facts.slice(0, 3)) {
      briefingLines.push(`확인된 내용: ${fact.claim} (출처: ${fact.source})`);
    }
    for (const question of briefing.questions.slice(0, 2)) {
      briefingLines.push(`쟁점 질문: ${question}`);
    }
    if (briefing.limitation) briefingLines.push(`주의: ${briefing.limitation}`);
  }

  const userPrompt = topic
    ? `오늘 토론 주제: "${topic}"\n${topicContext ? `화제 배경: ${topicContext}\n` : ''}${briefingLines.length ? `${briefingLines.join('\n')}\n` : ''}지금까지의 발언:\n${transcript || '(아직 없음)'}\n\n${speakerLabel}로서 ${turnHint(turnIndex)} 반드시 새로운 내용(질문·이유·반박·예시)을 하나 더하고, 한국어 반말 40~90자(최대 100자)로 말해줘. ${previousText ? `바로 앞의 ${previousSpeaker ? ANIMAL_LABELS[previousSpeaker] : listenerLabel} 말을 구체적으로 받아줘.` : ''}`
    : `지금까지의 발언:\n${transcript || '(아직 없음)'}\n${listenerLabel}에게 ${speakerLabel}답게 먼저 말을 걸어줘. 한국어 반말 40~90자(최대 100자).`;

  const base = DEFAULT_CONFIG.baseUrl.replace(/\/$/, '');
  const chatSignal = fetchWithTimeout(CHAT_TIMEOUT_MS, signal);
  let text: string | undefined;
  try {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEFAULT_CONFIG.gatewaySecret}`,
        // 게이트웨이 폴백도 텍스트 전용 모델로 제한한다.
        'X-Text-Only-Models': '1',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              `너는 PenguinCut 설원에 사는 아기 ${speakerLabel}이다. MBTI는 ${ANIMAL_MBTI[speaker]}(${persona.keyword})이고 성향은 '${persona.style}'이다. ` +
              '이 성향을 살려 오직 한국어 반말 한 문단만 출력한다. ' +
              '같은 말을 반복하지 말고, 확인되지 않은 사실은 단정하지 말고, ' +
              '설명·분석·영어·따옴표·이모지·JSON은 절대 쓰지 않는다. 40~90자, 100자 넘지 마.',
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 1,
        max_tokens: 140,
        reasoning_effort: 'none',
        stream: false,
      }),
      signal: chatSignal,
    });
    if (response.ok) {
      const result = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = result.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) {
        const cleaned = cleanLine(content);
        if (isValidLine(cleaned)) {
          text = cleaned;
          consecutiveFailures = 0;
        }
      }
    }
    if (!text) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) {
        localFallbackUntil = performance.now() + LOCAL_FALLBACK_COOLDOWN_MS;
        consecutiveFailures = 0;
      }
    }
  } catch {
    consecutiveFailures += 1;
    if (consecutiveFailures >= 3) {
      localFallbackUntil = performance.now() + LOCAL_FALLBACK_COOLDOWN_MS;
      consecutiveFailures = 0;
    }
  } finally {
    cleanupFetchSignal(chatSignal);
  }

  return { text: text ?? fallback().text };
}
