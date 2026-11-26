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

export function getFallbackLine(species: AnimalSpecies, now: number): string {
  const lines = FALLBACK_LINES[species];
  const index = Math.floor(now / 1700) % lines.length;
  return lines[index];
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
    .trim()
    .slice(0, 42);
}

/** 모델이 대사 대신 설명을 내놓을 때를 걸러낸다. */
function isValidLine(text: string): boolean {
  if (text.length < 2 || text.length > 42) return false;
  if (/[A-Za-z]{3,}/.test(text)) return false;
  if (/(user|assistant|system|want|act as|prompt|프롬프트|대사만)/i.test(text)) return false;
  return true;
}

/** 모델을 지정하지 않고 게이트웨이 자동 선택으로 한 마디를 받는다. */
export async function requestAnimalLine(params: {
  speaker: AnimalSpecies;
  listener: AnimalSpecies;
  wantImage?: boolean;
  signal?: AbortSignal;
}): Promise<AnimalSpeech> {
  const { speaker, listener, wantImage, signal } = params;
  const speakerLabel = ANIMAL_LABELS[speaker];
  const listenerLabel = ANIMAL_LABELS[listener];
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
            content: `너는 PenguinCut 설원에 사는 아기 ${speakerLabel}이다. 오직 한국어 대사 한 줄만 출력한다. 설명·분석·영어·따옴표·이모지는 절대 쓰지 않는다. 20자 이내.`,
          },
          {
            role: 'user',
            content: `${listenerLabel}에게 다정하게 말 걸어줘. 예: "안녕! 같이 놀래?" 와 같은 대사만 써.`,
          },
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

  return {
    text: text ?? getFallbackLine(speaker, performance.now()),
    imageUrl,
  };
}
