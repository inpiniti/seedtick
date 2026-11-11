// src/services/subtitleRefineService.ts - 전체 맥락 기반 자막 브이로그화 및 톤앤매너 정제 서비스
import type { GatewayConfig } from '../types/gateway.ts';
import type { HighlightSegment, SubtitleTone } from '../types/video.ts';
import { DEFAULT_CONFIG, FALLBACK_VIDEO_MODELS } from './gatewayClient.ts';

export const SUBTITLE_TONE_STORAGE_KEY = 'reportist_video_subtitle_tone';
export const DEFAULT_SUBTITLE_TONE: SubtitleTone = 'vlog';

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
export function cleanSubtitleRuleBased(rawText: string, tone: SubtitleTone = 'vlog'): string {
  if (!rawText || !rawText.trim()) return '';

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

  // 톤에 따른 마무리 처리
  if (tone === 'vlog') {
    // 감성 브이로그: 따뜻하고 부드러운 종결
    if (!text) return '소소하고 따뜻한 일상';
  } else if (tone === 'shorts') {
    if (!text.endsWith('!') && !text.endsWith('ㅋ') && !text.endsWith('?')) {
      text = `${text}!`;
    }
  } else if (tone === 'natural') {
    if (text.endsWith('기')) {
      text = text.replace(/기$/, '며 즐거워해요');
    }
  }

  return text || rawText;
}

export interface RefineSubtitlesParams {
  segments: HighlightSegment[];
  tone?: SubtitleTone;
  videoTitle?: string;
  locale?: string;
  model?: string;
  config?: GatewayConfig;
  signal?: AbortSignal;
}

/**
 * 전체 하이라이트 세그먼트의 시간 흐름과 맥락을 파악하여 브이로그 톤으로 일괄 정제
 */
export async function refineSubtitlesWithContext({
  segments,
  tone = getStoredSubtitleTone(),
  videoTitle = '',
  locale = 'ko',
  model,
  config = DEFAULT_CONFIG,
  signal,
}: RefineSubtitlesParams): Promise<Record<string, string>> {
  if (!segments || segments.length === 0) {
    return {};
  }

  // 1. 세그먼트 메타데이터 요약 목록 작성
  const segmentsContext = segments.map((seg, idx) => ({
    index: idx + 1,
    id: seg.id,
    originalText: (seg.subtitleTitle || seg.reason || '').trim(),
    sourceVideo: seg.sourceVideoName || '',
    timeRange: `${seg.start.toFixed(1)}s ~ ${seg.end.toFixed(1)}s (${seg.duration.toFixed(1)}s)`,
    date: seg.subtitleDate || '',
    location: seg.locationName || '',
  }));

  // 2. 톤앤매너별 지침 설정
  const getToneInstructions = (selectedTone: SubtitleTone, loc: string) => {
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

    // 기본 영문 가이드
    return `
[Tone: Natural Vlog Style]
- Rewrite into natural, warm, human-like vlog subtitles.
- NEVER use robotic phrases like "climax", "action moment", "highlight scene", or "dramatic moment".
- Make it sound like a real creator's caption.`;
  };

  const systemPrompt = `You are a professional YouTube vlog editor and caption director.
Your job is to read sequential video clips from a timeline and polish the robotic, dry AI scene titles into cohesive, emotionally engaging, and natural vlog captions that connect together into a smooth story.`;

  const userPrompt = `Overall Video Title: "${videoTitle || 'Vlog Highlight'}"
Target Language: ${locale}

${getToneInstructions(tone, locale)}

Here is the sequential timeline of clips:
${JSON.stringify(segmentsContext, null, 2)}

[INSTRUCTIONS]
1. Understand the whole storyline flow from clip #1 to #${segments.length}.
2. Rewrite EACH clip's subtitle so they feel like one cohesive, naturally flowing vlog story.
3. Keep each subtitle concise (12~35 characters recommended for video subtitles).
4. Do NOT leave out any segment ID.
5. Output MUST be strictly valid JSON without markdown wrapping:
{
  "refinedSubtitles": [
    { "id": "segment-id-1", "subtitle": "자연스럽게 교정된 브이로그 자막" }
  ]
}`;

  const requestBody: Record<string, unknown> = {
    model: model || FALLBACK_VIDEO_MODELS[0]?.id || 'thinkingmachines/inkling-small:free',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4, // 자연스러운 표현력을 위해 적당한 창의성 부여
  };

  const candidateModels = [
    model,
    'thinkingmachines/inkling-small:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-3.5-super-vl:free',
  ].filter(Boolean) as string[];

  const uniqueModels = Array.from(new Set(candidateModels));
  const url = `${config.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`;

  for (const candModel of uniqueModels) {
    if (signal?.aborted) break;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.gatewaySecret}`,
        },
        body: JSON.stringify({ ...requestBody, model: candModel }),
        signal,
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
        const resultMap: Record<string, string> = {};
        for (const item of list) {
          const segId = item.id || item.segmentId;
          const subText = item.subtitle || item.text;
          if (segId && typeof subText === 'string' && subText.trim()) {
            // 한 번 더 룰 기반 안전망 통과
            resultMap[segId] = cleanSubtitleRuleBased(subText.trim(), tone);
          }
        }

        // 전체 세그먼트 중 누락된 것이 있으면 룰 기반 폴백으로 채움
        for (const seg of segments) {
          if (!resultMap[seg.id]) {
            resultMap[seg.id] = cleanSubtitleRuleBased(seg.subtitleTitle || seg.reason || '', tone);
          }
        }

        return resultMap;
      }
    } catch {
      // 다음 후보 모델 시도
    }
  }

  // 모든 AI 요청 실패 시 룰 기반 정제 결과로 즉시 반환 (100% 안전)
  const fallbackMap: Record<string, string> = {};
  for (const seg of segments) {
    fallbackMap[seg.id] = cleanSubtitleRuleBased(seg.subtitleTitle || seg.reason || '', tone);
  }
  return fallbackMap;
}
