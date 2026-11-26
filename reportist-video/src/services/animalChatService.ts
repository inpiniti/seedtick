import {
  ANIMAL_LABELS,
  type AnimalSpecies,
} from '../components/studio-v2/penguin-stage/species.ts';
import { DEFAULT_CONFIG } from './gatewayClient.ts';

/** 말풍선에 들어갈 내용. 이미지는 선택적으로 함께 온다. */
export interface AnimalSpeech {
  text: string;
  imageUrl?: string;
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

/** 게이트웨이 실패·쿼터 고갈 시 사용하는 종별 한국어 대사. */
const FALLBACK_LINES: Record<AnimalSpecies, string[]> = {
  penguin: ['오늘 설원 좀 춥네?', '같이 걸을래?', '발자국 남겼어!', '여기서 기다릴게.'],
  cat: ['어디 가냥?', '나도 같이 갈래.', '발끝 살짝 흔들렸어.', '여기서 낮잠 자려고.'],
  dog: ['안녕! 같이 뛰자!', '좋은 냄새 나는데?', '이리 와서 인사해!', '꼬리 흔드는 중이야.'],
  rabbit: ['깡총! 잘 따라오냥?', '귀가 자꾸 움직여.', '당근은 없어?', '여기서 뛰어놀자!'],
  bear: ['오늘도 포근하네.', '천천히 걸어도 돼.', '배 좀 채우고 갈래.', '여기 앉아 있을게.'],
  fox: ['오늘 날씨 딱 좋다!', '나 꼬리 좀 멋있지?', '저기 뭐가 있어?', '살짝 구경하고 올게.'],
  panda: ['음… 뭐 할까?', '눈이 좀 가려지네.', '천천히 오렴.', '여기가 편하당.'],
  koala: ['나무는 어디 있어?', '좀 더 안아도 될까?', '천천히 움직일게.', '여기서 쉬자.'],
  squirrel: ['도토리 어디 있냥?', '빨리빨리 가자!', '내 꼬리 좀 봐!', '위로 올라갈래?'],
  raccoon: ['오늘도 깜쪽같네.', '눈가가 좀 어둡지?', '이리 와서 같이 보자.', '물 씻고 올게.'],
  'polar-bear': ['목도리 따뜻해.', '설원이 집 같아.', '천천히 걸어도 돼.', '여기서 기다릴게.'],
  owl: ['후~ 잘 보고 있어.', '가슴 깃이 간지러워.', '밤이 오면 신나.', '조용히 지켜볼게.'],
};

/** 답변 폴백 — 이전 말을 받아 친근하게 받아치는 짧은 한국어 대사. */
const FALLBACK_REPLIES = [
  '그래! 같이 가자.',
  '오, 나도 그랬어!',
  '좋아, 같이 해보자.',
  '진짜? 나도 궁금했어.',
  'ㅋㅋ 귀엽다!',
  '응, 여기서 기다릴게.',
  '나도 그 생각 했어.',
  '그럼 같이 가보자!',
];

export function getFallbackLine(species: AnimalSpecies, now: number): string {
  const lines = FALLBACK_LINES[species];
  const index = Math.floor(now / 1700) % lines.length;
  return lines[index];
}

export function getFallbackReply(now: number): string {
  return FALLBACK_REPLIES[Math.floor(now / 1400) % FALLBACK_REPLIES.length];
}

const FALLBACK_OPINIONS = [
  '나는 그게 제일 좋다고 생각해!',
  '글쎄, 나는 좀 다르게 생각해.',
  '오, 그거 진짜 재밌겠다!',
  '나도 그 생각이었어!',
  '음… 잘 모르겠어.',
  '나는 저쪽이 더 마음에 들어.',
];

export function getFallbackOpinion(now: number): string {
  return FALLBACK_OPINIONS[Math.floor(now / 1600) % FALLBACK_OPINIONS.length];
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

export function getFallbackTopic(now: number): string {
  return FALLBACK_TOPICS[Math.floor(now / 22000) % FALLBACK_TOPICS.length];
}

const TREND_CLIENT_TTL_MS = 15 * 60 * 1000;
const TREND_FETCH_TIMEOUT_MS = 3000;
let cachedTrendPool: DiscussionTopicInfo[] = [];
let trendPoolFetchedAt = 0;
let trendCursor = 0;
let trendFetchPromise: Promise<DiscussionTopicInfo[]> | null = null;

function loadTrendPool(signal?: AbortSignal): Promise<DiscussionTopicInfo[]> {
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
          topic: typeof item.topic === 'string' ? item.topic.trim().slice(0, 42) : '',
          context: typeof item.context === 'string' ? item.context.trim().slice(0, 80) : undefined,
        }))
        .filter((item) => item.topic.length >= 4);
      if (items.length === 0) return [];
      cachedTrendPool = items;
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
export async function requestDiscussionTopic(
  signal?: AbortSignal
): Promise<DiscussionTopicInfo> {
  if (
    cachedTrendPool.length > 0 &&
    performance.now() - trendPoolFetchedAt < TREND_CLIENT_TTL_MS
  ) {
    const item = cachedTrendPool[trendCursor % cachedTrendPool.length];
    trendCursor += 1;
    if (item) return item;
  }
  const pool = await loadTrendPool(signal);
  if (pool.length > 0) {
    const item = pool[trendCursor % pool.length] ?? pool[0];
    trendCursor += 1;
    if (item) return item;
  }
  return { topic: getFallbackTopic(performance.now()) };
}

const CHAT_TIMEOUT_MS = 7000;
const IMAGE_TIMEOUT_MS = 14000;

function fetchWithTimeout(
  timeoutMs: number,
  signal?: AbortSignal
): AbortSignal {
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

/** 모델을 지정하지 않고 게이트웨이 자동 선택으로 한 마디를 받는다. */
export async function requestAnimalLine(params: {
  speaker: AnimalSpecies;
  listener: AnimalSpecies;
  /** 바로 전에 상대가 한 말. 있으면 답변으로 처리한다. */
  previousText?: string;
  previousSpeaker?: AnimalSpecies;
  /** 토론 모드: 주제와 최근 발언 목록을 함께 넘긴다. */
  topic?: string;
  topicContext?: string;
  history?: DiscussionEntry[];
  wantImage?: boolean;
  signal?: AbortSignal;
}): Promise<AnimalSpeech> {
  const {
    speaker,
    listener,
    previousText,
    previousSpeaker,
    topic,
    topicContext,
    history,
    wantImage,
    signal,
  } = params;
  const speakerLabel = ANIMAL_LABELS[speaker];
  const listenerLabel = ANIMAL_LABELS[listener];
  const base = DEFAULT_CONFIG.baseUrl.replace(/\/$/, '');
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
            content: `너는 PenguinCut 설원에 사는 아기 ${speakerLabel}이다. 오직 한국어 대사 한 줄만 출력한다. 설명·분석·영어·따옴표·이모지는 절대 쓰지 않는다. 20자 이내.`,
          },
          { role: 'user', content: userPrompt },
        ],
        temperature: 1,
        max_tokens: 64,
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
        if (isValidLine(cleaned)) text = cleaned;
      }
    }
  } catch {
    // 실패 시 로컬 대사로 폴백한다.
  } finally {
    cleanupFetchSignal(chatSignal);
  }

  let imageUrl: string | undefined;
  if (wantImage && !signal?.aborted) {
    const imageSignal = fetchWithTimeout(IMAGE_TIMEOUT_MS, signal);
    try {
      const response = await fetch(`${base}/v1/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEFAULT_CONFIG.gatewaySecret}`,
        },
        body: JSON.stringify({
          prompt: `cute chibi ${speakerLabel} character standing in a quiet minimalist snow field, soft monochrome sticker illustration, simple rounded shapes, warm light`,
          n: 1,
          aspect_ratio: '1:1',
        }),
        signal: imageSignal,
      });
      if (response.ok) {
        const result = (await response.json()) as {
          data?: Array<{ url?: string }>;
        };
        const url = result.data?.[0]?.url;
        if (typeof url === 'string' && url.startsWith('data:image/')) imageUrl = url;
      }
    } catch {
      // 이미지 실패는 텍스트 대사에 영향을 주지 않는다.
    } finally {
      cleanupFetchSignal(imageSignal);
    }
  }

  const fallback = isReply
    ? getFallbackReply(performance.now())
    : topic
      ? getFallbackOpinion(performance.now())
      : getFallbackLine(speaker, performance.now());
  return {
    text: text ?? fallback,
    imageUrl,
  };
}
