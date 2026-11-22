// src/services/subtitleRefineService.ts - 전체 맥락 기반 자막 브이로그화 및 톤앤매너 정제 서비스
import type { GatewayConfig } from '../types/gateway.ts';
import type { HighlightMode, HighlightSegment, SubtitleTone } from '../types/video.ts';
import { DEFAULT_CONFIG, FALLBACK_VIDEO_MODELS } from './gatewayClient.ts';
import { getStoredUserApiKeyConfig, isByokActive } from './userApiKeyService.ts';

export const SUBTITLE_TONE_STORAGE_KEY = 'reportist_video_subtitle_tone';
export const DEFAULT_SUBTITLE_TONE: SubtitleTone = 'vlog';

// 자막 다듬기 시간 상한: 요청당 20초, 전체 180초(컷이 많으면 청크별로 나눠 호출한다)
const REFINE_REQUEST_TIMEOUT_MS = 20_000;
const REFINE_TOTAL_BUDGET_MS = 180_000;
// 한 번의 요청에 보내는 컷 수. 100개가 넘는 프로젝트에서 거대한 JSON이 잘려
// 파싱에 실패하고 영어 원문이 그대로 남던 문제를 막는다.
const REFINE_CHUNK_SIZE = 20;

const TARGET_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ko: 'Korean (한국어)',
  ja: 'Japanese (日本語)',
  zh: 'Chinese (中文)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
};

function getTargetLanguageName(locale: string): string {
  const base = locale.toLowerCase().split('-')[0];
  return TARGET_LANGUAGE_NAMES[base] || locale;
}

/**
 * 브라우저 localStorage에 저장된 자막 톤앤매너 설정 불러오기
 */
export function getStoredSubtitleTone(): SubtitleTone {
  try {
    const saved = localStorage.getItem(SUBTITLE_TONE_STORAGE_KEY) as SubtitleTone | null;
    if (saved && (saved === 'vlog' || saved === 'shorts' || saved === 'natural' || saved === 'minimal')) {
      return saved;
    }
  } catch {
    // fallback
  }
  return DEFAULT_SUBTITLE_TONE;
}

/**
 * 자막 톤앤매너 설정 localStorage 저장
 */
export function setStoredSubtitleTone(tone: SubtitleTone): void {
  try {
    localStorage.setItem(SUBTITLE_TONE_STORAGE_KEY, tone);
  } catch {
    // ignore
  }
}

/**
 * 딱딱한 AI 보고서식 단어('클라이맥스', '박진감 넘치는 액션 순간' 등)를 제거하는 룰 기반 정제기
 * AI Gateway 연결 실패 시의 비상 폴백 및 AI 응답 후처리용
 */
export function cleanSubtitleRuleBased(
  rawText: string,
  tone: SubtitleTone = 'vlog',
  locale: string = 'ko'
): string {
  if (!rawText || !rawText.trim()) return '';

  const isKorean = locale.toLowerCase().startsWith('ko');
  let text = rawText.trim();

  // 흔한 AI 상투 문구 치환 / 제거
  const clichés = [
    /의\s*최고의\s*클라이맥스\s*순간/g,
    /최고의\s*클라이맥스\s*순간/g,
    /박진감\s*넘치는\s*액션\s*순간/g,
    /박진감\s*넘치는\s*순간/g,
    /액션\s*순간/g,
    /클라이맥스\s*순간/g,
    /클라이맥스/g,
    /하이라이트\s*순간/g,
    /하이라이트\s*장면/g,
    /하이라이트/g,
    /결정적\s*순간/g,
    /극적\s*순간/g,
    /결정적인\s*장면/g,
    /하는\s*장면/g,
    /하는\s*순간/g,
    /의\s*순간/g,
    /순간$/g,
    /장면$/g,
  ];

  for (const pattern of clichés) {
    text = text.replace(pattern, '').trim();
  }

  // 꼬리표 정리 및 조사 교정
  text = text
    .replace(/\s+/g, ' ')
    .replace(/하는\s*모습$/g, '하기')
    .replace(/보는\s*모습$/g, '보기')
    .replace(/먹는\s*모습$/g, '먹기')
    .replace(/움직이는\s*$/g, '움직이기')
    .replace(/웃는\s*$/g, '활짝 웃기')
    .replace(/앉는\s*$/g, '털썩 앉기')
    .replace(/걷는\s*$/g, '아장아장 걷기')
    .replace(/의\s*$/g, '')
    .trim();

  // 톤에 따른 마무리 처리 (비한국어 로케일에는 한국어 폴백 문구를 쓰지 않는다)
  if (tone === 'vlog') {
    // 감성 브이로그: 따뜻하고 부드러운 종결
    if (!text) return isKorean ? '소소하고 따뜻한 일상' : 'A little everyday moment';
  } else if (tone === 'shorts') {
    if (text && !text.endsWith('!') && !text.endsWith('?') && !text.endsWith('ㅋ')) {
      text = `${text}!`;
    }
  } else if (tone === 'natural' && isKorean) {
    if (text.endsWith('기')) {
      text = text.replace(/기$/, '며 즐거워해요');
    }
  }

  return text || rawText;
}

/**
 * 현재 자막이 UI 언어와 다른 언어(대표적으로 영어)로 만들어졌는지 간단히 판정한다.
 * 자막 단계의 언어 불일치 안내 배너를 보여줄 때 사용한다.
 */
export function detectSubtitleLanguageMismatch(
  texts: Array<string | undefined>,
  targetLocale: string
): boolean {
  const samples = texts
    .filter((t): t is string => Boolean(t && t.trim()))
    .slice(0, 40)
    .map((t) => t.trim());
  if (samples.length === 0) return false;

  const target = targetLocale.toLowerCase().split('-')[0];
  if (target === 'en') {
    const korean = samples.filter((t) => /[\uAC00-\uD7A3]/.test(t)).length;
    return korean / samples.length > 0.5;
  }

  const targetScript: RegExp | null =
    target === 'ko'
      ? /[\uAC00-\uD7A3]/
      : target === 'ja'
        ? /[\u3040-\u30ff\u4e00-\u9faf]/
        : target === 'zh'
          ? /[\u4e00-\u9faf]/
          : null;

  // es/fr/de 등 라틴 문자권은 영어와 구분이 어려우므로 배너를 띄우지 않는다.
  if (!targetScript) return false;

  const withTarget = samples.filter((t) => targetScript.test(t)).length;
  const withForeignLatin = samples.filter(
    (t) => /[A-Za-z]{3}/.test(t) && !targetScript.test(t)
  ).length;
  return withForeignLatin / samples.length > 0.5 && withTarget / samples.length < 0.2;
}

export interface RefineSubtitlesParams {
  segments: HighlightSegment[];
  tone?: SubtitleTone;
  videoTitle?: string;
  locale?: string;
  model?: string;
  config?: GatewayConfig;
  signal?: AbortSignal;
  /** 하이라이트 방식 (quick-cut이면 1초 안에 읽히는 초단문 자막으로 정제) */
  highlightMode?: HighlightMode;
  /** 청크별 진행률 (완료 컷 수 / 전체 컷 수) */
  onProgress?: (completed: number, total: number) => void;
  /** AI 호출이 실패해 룰 기반 폴백으로 처리된 청크가 있을 때 호출 */
  onFallback?: (info: { failedBatches: number; totalBatches: number }) => void;
}

type SegmentContext = {
  index: number;
  id: string;
  originalText: string;
  sourceVideo: string;
  timeRange: string;
  date: string;
  location: string;
};

function getToneInstructions(selectedTone: SubtitleTone, loc: string): string {
  if (loc === 'ko') {
    switch (selectedTone) {
      case 'vlog':
        return `
 [톤앤매너: 감성 브이로그 (Vlog Emotion)]
 - 1인칭 화자의 시선과 따뜻한 감정이 묻어나는 자연스러운 브이로그 자막으로 다듬어 주세요.
 - **절대 금지 단어**: '클라이맥스', '순간', '장면', '액션', '포착', '박진감', '~하는 모습' 등 로봇/AI 보고서식 표현 일체 금지!
 - 분위기 있는 표현, 소소한 일상의 설렘, 귀여운 행동 묘사 위주로 표현하세요.
 - 예시:
   * "아기가 카드를 들고 움직이는 박진감 넘치는 액션 순간" ❌ -> "카드 꼭 쥐고 꼬물꼬물 탐색 중 🃏" ⭕
   * "입가에 케이크가 묻은 채 환하게 카메라를 보며 손을 부드럽게 모는 아기의 최고의 클라이맥스 순간" ❌ -> "입가에 케이크 묻히고 심쿵 미소 발사 🎂" ⭕
   * "아기가 카메라를 바라보며 안정적으로 걸어가다 예상치 못한 자리에 앉는 클라이맥스" ❌ -> "아장아장 걷다가 털썩 주저앉기 🐾" ⭕
   * "바닷가 산책하는 장면" ❌ -> "시원한 바닷바람 맞으며 힐링 산책 🌊" ⭕`;

      case 'shorts':
        return `
 [톤앤매너: 텐션 UP 쇼츠/릴스 (Shorts & Reels Tension)]
 - 유튜브 쇼츠/인스타 릴스 스타일에 어울리는 짧고 굵은 리액션, 위트, 빵 터지는 자막으로 다듬어 주세요.
 - **절대 금지 단어**: '클라이맥스', '박진감 넘치는', '보고서식 설명'
 - 예시:
   * "카드 들고 급발진 ㅋㅋㅋ"
   * "케이크 먹방 레전드 찍음 🎂"
   * "갑자기 왜 거기 앉는데 🤣"`;

      case 'natural':
        return `
 [톤앤매너: 자연스러운 구어체 (Conversational)]
 - 친구나 가족에게 이야기하듯 친근하고 부드러운 구어체(~해요, ~했어)로 다듬어 주세요.
 - **절대 금지 단어**: '클라이맥스', '순간', '장면'
 - 예시:
   * "카드 들고 신나게 움직여요"
   * "케이크 묻히고 활짝 웃어줬어요"
   * "열심히 걷다가 털썩 앉았어요"`;

      case 'minimal':
      default:
        return `
 [톤앤매너: 담백한 일상 요약 (Minimal & Clean)]
 - 군더더기 없이 깔끔하고 담백하게 핵심 행동과 상황만 정갈하게 정리해 주세요.
 - **절대 금지 단어**: '클라이맥스', '순간', '박진감'
 - 예시:
   * "카드 놀이 시간"
   * "달콤한 케이크 한 입"
   * "아장아장 걸음마"`;
    }
  }

  return `
 [Tone: Natural Vlog Style]
 - Rewrite into natural, warm, human-like vlog subtitles.
 - NEVER use robotic phrases like "climax", "action moment", "highlight scene", or "dramatic moment".
 - Make it sound like a real creator's caption.`;
}

function buildPrompts(params: {
  chunk: SegmentContext[];
  totalCount: number;
  videoTitle: string;
  targetLangName: string;
  tone: SubtitleTone;
  locale: string;
  isQuickCut: boolean;
}): { systemPrompt: string; userPrompt: string } {
  const { chunk, totalCount, videoTitle, targetLangName, tone, locale, isQuickCut } = params;

  const systemPrompt = `You are a professional YouTube vlog editor and caption director.
Your job is to read sequential video clips from a timeline and polish the robotic, dry AI scene titles into cohesive, emotionally engaging, and natural vlog captions that connect together into a smooth story.`;

  const userPrompt = `Overall Video Title: "${videoTitle || 'Vlog Highlight'}"
Target Language: ${targetLangName}

[CRITICAL LANGUAGE RULE]
- Every subtitle you output MUST be written in ${targetLangName}.
- IGNORE the language of "originalText". Even when the original text is English or any other language, you MUST translate it into ${targetLangName} first, then rewrite it. NEVER copy the original text verbatim.
- If an original text is already in ${targetLangName}, just polish it naturally. Do not switch back to the source language.

${getToneInstructions(tone, locale)}

Here is a sequential slice of the timeline (${chunk.length} clips, ${totalCount} clips in the whole video):
${JSON.stringify(chunk, null, 2)}

[INSTRUCTIONS]
1. Understand the storyline flow of these clips.
2. Rewrite EACH clip's subtitle so they feel like one cohesive, naturally flowing vlog story in ${targetLangName}.
${
  isQuickCut
    ? `3. Keep each subtitle ULTRA-SHORT: 2 to 4 words. Each cut lasts only about 1 second, so the caption must be readable instantly in ${targetLangName}.`
    : `3. Keep each subtitle concise (12~35 characters recommended for video subtitles in ${targetLangName}).`
}
4. Do NOT leave out any segment ID.
5. Output MUST be strictly valid JSON without markdown wrapping:
{
  "refinedSubtitles": [
    { "id": "segment-id-1", "subtitle": "자연스럽게 교정된 브이로그 자막" }
  ]
}`;

  return { systemPrompt, userPrompt };
}

/**
 * 전체 하이라이트 세그먼트의 시간 흐름과 맥락을 파악하여 브이로그 톤으로 일괄 정제
 *
 * 컷이 많을 때(예: 135개) 한 번에 보내면 타임아웃/출력 토큰 한도로 JSON이 잘려
 * 영어 원문이 그대로 남던 문제가 있었다. 20개 단위 청크로 나눠 요청하고,
 * 실패한 청크는 룰 기반으로 처리하되 onFallback으로 알려 UI가 정직하게 안내하도록 한다.
 */
export async function refineSubtitlesWithContext({
  segments,
  tone = getStoredSubtitleTone(),
  videoTitle = '',
  locale = 'ko',
  model,
  config = DEFAULT_CONFIG,
  signal,
  highlightMode = 'story',
  onProgress,
  onFallback,
}: RefineSubtitlesParams): Promise<Record<string, string>> {
  if (!segments || segments.length === 0) {
    return {};
  }

  const isQuickCut = highlightMode === 'quick-cut';
  const targetLangName = getTargetLanguageName(locale);

  // P0: 자막 다듬기도 본 분석과 동일하게 BYOK(내 API 키)와 ZDR 정책을 따라야 한다.
  // 이전에는 공용 게이트웨이 시크릿으로만 호출해 사용자가 키를 설정해도 우회되었다.
  const activeUserKeyConfig = isByokActive() ? getStoredUserApiKeyConfig() : null;
  const hasUserKey = Boolean(activeUserKeyConfig?.apiKey?.trim());
  const customHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.gatewaySecret}`,
  };
  if (hasUserKey && activeUserKeyConfig) {
    customHeaders['X-User-Api-Key'] = activeUserKeyConfig.apiKey.trim();
    customHeaders['X-User-Provider'] = activeUserKeyConfig.provider;
    if (activeUserKeyConfig.model?.trim()) {
      customHeaders['X-User-Model'] = activeUserKeyConfig.model.trim();
    }
    if (activeUserKeyConfig.baseUrl?.trim()) {
      customHeaders['X-User-Base-Url'] = activeUserKeyConfig.baseUrl.trim();
    }
  }

  const configuredModel = hasUserKey
    ? (activeUserKeyConfig?.model?.trim() || model || 'gpt-4o-mini')
    : (model || FALLBACK_VIDEO_MODELS[0]?.id || 'thinkingmachines/inkling-small:free');

  // BYOK 사용자는 본인 키로 지정한 모델 1개만 시도하고, 무료 게이트웨이는 폴백 모델을 순회한다.
  const candidateModels = hasUserKey
    ? [configuredModel]
    : [
        model,
        'thinkingmachines/inkling-small:free',
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        'nvidia/nemotron-3.5-super-vl:free',
      ].filter(Boolean) as string[];

  const uniqueModels = Array.from(new Set(candidateModels));
  const url = `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;
  const deadline = Date.now() + REFINE_TOTAL_BUDGET_MS;

  // 1. 세그먼트 메타데이터 요약 목록 작성
  const segmentsContext: SegmentContext[] = segments.map((seg, idx) => ({
    index: idx + 1,
    id: seg.id,
    originalText: (seg.subtitleTitle || seg.reason || '').trim(),
    sourceVideo: seg.sourceVideoName || '',
    timeRange: `${seg.start.toFixed(1)}s ~ ${seg.end.toFixed(1)}s (${seg.duration.toFixed(1)}s)`,
    date: seg.subtitleDate || '',
    location: seg.locationName || '',
  }));

  const chunks: SegmentContext[][] = [];
  for (let i = 0; i < segmentsContext.length; i += REFINE_CHUNK_SIZE) {
    chunks.push(segmentsContext.slice(i, i + REFINE_CHUNK_SIZE));
  }

  const resultMap: Record<string, string> = {};
  let failedBatches = 0;
  let completed = 0;
  onProgress?.(0, segments.length);

  for (const chunk of chunks) {
    if (signal?.aborted) break;

    const { systemPrompt, userPrompt } = buildPrompts({
      chunk,
      totalCount: segments.length,
      videoTitle,
      targetLangName,
      tone,
      locale,
      isQuickCut,
    });

    let chunkResult: Record<string, string> | null = null;

    for (const candModel of uniqueModels) {
      if (signal?.aborted) break;
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;

      const requestController = new AbortController();
      const onParentAbort = () => requestController.abort(signal?.reason);
      signal?.addEventListener('abort', onParentAbort, { once: true });
      const timer = setTimeout(
        () => requestController.abort(new DOMException('Subtitle refine timed out', 'TimeoutError')),
        Math.min(REFINE_REQUEST_TIMEOUT_MS, remainingMs)
      );

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: customHeaders,
          body: JSON.stringify({
            model: candModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.4, // 자연스러운 표현력을 위해 적당한 창의성 부여
            // P0: 본 분석과 동일하게 데이터 미보관(ZDR) 플래그를 명시한다.
            data_collection: 'deny',
            zdr: true,
          }),
          signal: requestController.signal,
        });

        if (!response.ok) continue;

        const data = await response.json();
        const rawText = data?.choices?.[0]?.message?.content;
        if (!rawText || typeof rawText !== 'string') continue;

        // JSON 파싱 시도 (코드블록 제거 지원)
        const cleanJsonStr = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();

        const parsed = JSON.parse(cleanJsonStr);
        const list = parsed?.refinedSubtitles || parsed?.subtitles;

        if (Array.isArray(list) && list.length > 0) {
          const map: Record<string, string> = {};
          for (const item of list) {
            const segId = item.id || item.segmentId;
            const subText = item.subtitle || item.text;
            if (segId && typeof subText === 'string' && subText.trim()) {
              // 한 번 더 룰 기반 안전망 통과
              map[segId] = cleanSubtitleRuleBased(subText.trim(), tone, locale);
            }
          }
          if (Object.keys(map).length > 0) {
            chunkResult = map;
            break;
          }
        }
      } catch {
        // 다음 후보 모델 시도 (타임아웃 포함)
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onParentAbort);
      }
    }

    if (chunkResult) {
      Object.assign(resultMap, chunkResult);
    } else {
      failedBatches += 1;
      // 이 청크는 룰 기반 폴백. 원문이 영어면 영어가 남을 수 있어 UI에 알린다.
      for (const item of chunk) {
        const original = segments.find((s) => s.id === item.id);
        resultMap[item.id] = cleanSubtitleRuleBased(
          original?.subtitleTitle || original?.reason || '',
          tone,
          locale
        );
      }
    }

    completed += chunk.length;
    onProgress?.(completed, segments.length);
  }

  if (failedBatches > 0) {
    onFallback?.({ failedBatches, totalBatches: chunks.length });
  }

  // 전체 세그먼트 중 누락된 것이 있으면 룰 기반 폴백으로 채움
  for (const seg of segments) {
    if (!resultMap[seg.id]) {
      resultMap[seg.id] = cleanSubtitleRuleBased(seg.subtitleTitle || seg.reason || '', tone, locale);
    }
  }

  return resultMap;
}
