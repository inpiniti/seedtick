import {
  ANIMAL_LABELS,
  ANIMAL_MBTI,
  ANIMAL_PERSONAS,
  type AnimalSpecies,
} from '../components/studio-v2/penguin-stage/species.ts';
import { DEFAULT_CONFIG } from './gatewayClient.ts';

/** 말풍선에 들어갈 내용. */
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
  context?: string;
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

/** LLM 실패 시 종별로 돌려쓰는 MBTI 말투 대사. 라운드마다 다른 문장이 나온다. */
const FALLBACK_LINES: Record<AnimalSpecies, readonly string[]> = {
  penguin: [
    '다들 얘기 좀 들어봐~',
    '너희 의견이 제일 궁금해!',
    '같이 이야기하니까 좋다.',
    '그래서 어떻게 생각해?',
    '내가 먼저 말해볼게!',
  ],
  cat: [
    '음, 그건 좀 애매하네.',
    '근거가 뭔데?',
    '호기심이 생기긴 하다.',
    '나는 좀 다르게 봐.',
    '그건 좀 아니지 않나?',
  ],
  dog: [
    '와, 완전 신나!',
    '나도 같이 하자!',
    '이거 재밌겠다!',
    '좋아, 바로 해보자!',
    '다들 최고야!',
  ],
  rabbit: [
    '이거 요즘 핫하지!',
    '나 제일 먼저 알았어~',
    '통통 튀는 얘기 좋다!',
    '이번엔 내가 pick!',
    '와, 완전 트렌드야!',
  ],
  bear: [
    '음~ 듣기 좋네.',
    '천천히 하자, 급하지 않아.',
    '배 채우고 이야기하자.',
    '편한 게 제일이야.',
    '따뜻해서 좋다.',
  ],
  fox: [
    '진짜? 나는 반대!',
    '색다른 생각이 필요하지~',
    '그건 좀 아니지 않아?',
    '내가 한 수 가르쳐줄게.',
    '오, 재밌는 얘기다!',
  ],
  panda: [
    '음… 느긋하게 하자~',
    '누워서 생각 중이야.',
    '평화로워서 좋당.',
    '천천히 오렴~',
    '나는 그냥 좋다~',
  ],
  koala: [
    '나는 패스, 귀찮아.',
    '에너지 아끼자.',
    '짧게 말할게, 피곤해.',
    '그냥 넘기자.',
    '나무만 있으면 돼.',
  ],
  squirrel: [
    '준비물부터 챙기자!',
    '가성비 따져봐야지.',
    '빨리빨리 하자!',
    '계획 세웠어?',
    '이거 저장해둘게!',
  ],
  raccoon: [
    '일단 내가 해볼게!',
    '고민 말고 바로 해보자!',
    '이거 내가 찾았어!',
    '호기심이 못 참겠어.',
    '직접 해보면 알지!',
  ],
  'polar-bear': [
    '오래 두고 생각해볼게.',
    '속에 뭐가 있을까?',
    '차분히 얘기하자.',
    '설원이 조용해서 좋다.',
    '깊이 있는 얘기네.',
  ],
  owl: [
    '결론은 이거야.',
    '흐름을 보면 다 보여.',
    '밤에 생각이 잘 나.',
    '한 번 더 따져보자.',
    '정리하면 됐어.',
  ],
};

export function getFallbackLine(species: AnimalSpecies, seed: number): string {
  const lines = FALLBACK_LINES[species];
  return lines[Math.abs(Math.floor(seed)) % lines.length] ?? lines[0] ?? '그렇구나!';
}

const TREND_CLIENT_TTL_MS = 15 * 60 * 1000;
const TREND_FETCH_TIMEOUT_MS = 15_000;
let cachedTopics: DiscussionTopicInfo[] = [];
let trendPoolFetchedAt = 0;
let trendCursor = 0;
let trendFetchPromise: Promise<DiscussionTopicInfo[]> | null = null;

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

async function loadTrendPool(signal?: AbortSignal): Promise<DiscussionTopicInfo[]> {
  if (trendFetchPromise) return trendFetchPromise;
  const base = DEFAULT_CONFIG.baseUrl.replace(/\/$/, '');
  const controller = fetchWithTimeout(TREND_FETCH_TIMEOUT_MS, signal);
  trendFetchPromise = (async (): Promise<DiscussionTopicInfo[]> => {
    try {
      const response = await fetch(`${base}/v1/trends`, {
        headers: { Accept: 'application/json' },
        signal: controller,
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        items?: Array<{ topic?: string; context?: string }>;
      };
      const items = (payload.items ?? [])
        .map((item) => ({
          topic: typeof item?.topic === 'string' ? item.topic.trim().slice(0, 42) : '',
          context:
            typeof item?.context === 'string' ? item.context.trim().slice(0, 80) : undefined,
        }))
        .filter((item) => item.topic.length >= 4);
      if (items.length === 0) return [];

      cachedTopics = items;
      trendPoolFetchedAt = performance.now();
      trendCursor = 0;
      return items;
    } catch {
      return [];
    } finally {
      cleanupFetchSignal(controller);
      trendFetchPromise = null;
    }
  })();
  return trendFetchPromise;
}

/** 게이트웨이 /v1/trends 캐시 풀에서 주제를 순환 반환. 실패 시 로컬 주제. */
export async function requestDiscussionTopic(signal?: AbortSignal): Promise<DiscussionTopicInfo> {
  if (
    cachedTopics.length > 0 &&
    performance.now() - trendPoolFetchedAt < TREND_CLIENT_TTL_MS
  ) {
    const item = cachedTopics[trendCursor % cachedTopics.length];
    trendCursor += 1;
    if (item) return item;
  }
  const pool = await loadTrendPool(signal);
  if (pool.length > 0) {
    const item = pool[trendCursor % pool.length] ?? pool[0];
    trendCursor += 1;
    if (item) return item;
  }
  return {
    topic: FALLBACK_TOPICS[Math.floor(performance.now() / 22000) % FALLBACK_TOPICS.length] ?? '',
  };
}

const CHAT_TIMEOUT_MS = 7000;
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

/** 매 턴 /v1/chat/completions로 MBTI 성향이 담긴 한 마디를 받는다. */
export async function requestAnimalLine(params: {
  speaker: AnimalSpecies;
  listener: AnimalSpecies;
  previousText?: string;
  previousSpeaker?: AnimalSpecies;
  topic?: string;
  topicContext?: string;
  history?: DiscussionEntry[];
  signal?: AbortSignal;
}): Promise<AnimalSpeech> {
  const { speaker, listener, previousText, previousSpeaker, topic, topicContext, history, signal } =
    params;
  const now = performance.now();
  const fallback = (): AnimalSpeech => ({
    text: getFallbackLine(speaker, Math.floor(now / 1500) + (history?.length ?? 0)),
  });

  if (signal?.aborted || now < localFallbackUntil) return fallback();

  const speakerLabel = ANIMAL_LABELS[speaker];
  const listenerLabel = ANIMAL_LABELS[listener];
  const persona = ANIMAL_PERSONAS[speaker];
  const isReply = Boolean(previousText);
  const previousSpeakerLabel = previousSpeaker ? ANIMAL_LABELS[previousSpeaker] : listenerLabel;
  const transcript = (history ?? [])
    .slice(-3)
    .map((entry) => `${ANIMAL_LABELS[entry.speaker]}: ${entry.text}`)
    .join('\n');
  const contextLine = topicContext ? `오늘의 화제 배경: ${topicContext}\n` : '';
  const userPrompt = topic
    ? `오늘 토론 주제: "${topic}"\n${contextLine}지금까지의 발언:\n${transcript || '(아직 없음)'}\n${speakerLabel}로서 이 주제에 대한 네 솔직한 취향이나 의견을 한국어 반말 한 줄로 말해줘. 앞선 친구 말에 맞장구치거나 반박해도 좋아.`
    : isReply
      ? `방금 ${previousSpeakerLabel}이 "${previousText}"라고 했어. ${speakerLabel}로서 자연스럽게 받아치는 한국어 대사 한 줄만 써.`
      : `${listenerLabel}에게 다정하게 말 걸어줘. 예: "안녕! 같이 놀래?" 와 같은 대사만 써.`;

  const base = DEFAULT_CONFIG.baseUrl.replace(/\/$/, '');
  const chatSignal = fetchWithTimeout(CHAT_TIMEOUT_MS, signal);
  let text: string | undefined;
  try {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEFAULT_CONFIG.gatewaySecret}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `너는 PenguinCut 설원에 사는 아기 ${speakerLabel}이다. MBTI는 ${ANIMAL_MBTI[speaker]}(${persona.keyword})이고 성향은 '${persona.style}'이다. 이 성향을 살려서 오직 한국어 반말 한 줄만 출력한다. 설명·분석·영어·따옴표·이모지는 절대 쓰지 않는다. 20자 이내.`,
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 1,
        max_tokens: 64,
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
    // 실패 시 로컬 대사로 폴백한다.
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
