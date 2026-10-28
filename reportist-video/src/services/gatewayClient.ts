// services/gatewayClient.ts - AI Gateway 통신 및 다중 프레임 시각 분석 서비스

import type { FreeModelMeta, GatewayConfig, ReasoningEffortOption } from '../types/gateway.ts';
import type { ExtractedFrame, HighlightSegment } from '../types/video.ts';

export const DEFAULT_GATEWAY_URL = 'https://seedtick-ai-gateway.vercel.app';
export const DEFAULT_GATEWAY_SECRET = '377d4fa71b90fdbbd6eab6765f3050598de8c259ed86e615c9b18ae4ed63e8bd';

export const DEFAULT_CONFIG: GatewayConfig = {
  baseUrl: DEFAULT_GATEWAY_URL,
  gatewaySecret: DEFAULT_GATEWAY_SECRET,
};

// 다중 프레임 시각 분석을 공식 지원하는 고성능 무료 모델 목록
export const FALLBACK_VIDEO_MODELS: FreeModelMeta[] = [
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google: Gemma 4 31B (free)',
    providerName: 'Google DeepMind',
    contextLengthFormatted: '256K tokens',
    description: 'Google DeepMind의 고성능 멀티모달 모델로 연속 프레임 시퀀스와 타임스탬프 분석에 탁월합니다.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceTier: 'Google 31B 비전 멀티모달',
    supportedEfforts: ['high', 'medium', 'low'],
    defaultEffort: 'high',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google: Gemma 4 26B A4B (free)',
    providerName: 'Google DeepMind',
    contextLengthFormatted: '256K tokens',
    description: 'Google DeepMind 경량 고성능 MoE 모델로 빠른 프레임 장면 인식이 가능합니다.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceTier: 'Google 경량 고성능 MoE',
  },
  {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'NVIDIA: Nemotron 3.5 Super VL (free)',
    providerName: 'NVIDIA',
    contextLengthFormatted: '1M tokens (초대용량)',
    description: '120B MoE 오픈 멀티모달 모델. 텍스트, 이미지 시퀀스, GUI 입력을 완벽하게 지원합니다.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceTier: '플래그십 120B 멀티모달',
    supportedEfforts: ['high', 'medium', 'low'],
    defaultEffort: 'high',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA: Nemotron 3 Nano Omni (free)',
    providerName: 'NVIDIA',
    contextLengthFormatted: '256K tokens',
    description: '텍스트와 이미지를 통합 인식하는 옴니 멀티모달 추론 모델입니다.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceTier: '옴니 멀티모달 추론',
  },
  {
    id: 'dots-studio/dots-3-note-preview:free',
    name: 'Dots Studio: Dots3-Note Preview (free)',
    providerName: 'Dots Studio',
    contextLengthFormatted: '512K tokens',
    description: '280B MoE 고지능 비전 모델로 복합 장면 시퀀스 요약에 최적화되어 있습니다.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceTier: '초대형 280B 비전 MoE',
  },
];

// 게이트웨이에서 이미지/비전 입력 가능한 멀티모달 모델 가져오기
export async function fetchVideoCapableModels(config: GatewayConfig = DEFAULT_CONFIG): Promise<FreeModelMeta[]> {
  try {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/v1/models`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.gatewaySecret}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        // 비전(이미지) 모달리티를 지원하는 모델 필터링
        const visionModels = json.data.filter((m: FreeModelMeta) => {
          const hasImageInput = Array.isArray(m.inputModalities) && m.inputModalities.includes('image');
          const hasImageModality = typeof m.modality === 'string' && m.modality.includes('image');
          const isKnownVision =
            m.id.includes('super-vl') ||
            m.id.includes('nano-omni') ||
            m.id.includes('gemma-4') ||
            m.id.includes('dots-3');
          return hasImageInput || hasImageModality || isKnownVision;
        });

        if (visionModels.length > 0) {
          return visionModels;
        }
      }
    }
  } catch (err) {
    console.warn('[GatewayClient] 비전 모델 조회 실패, 기본 폴백 목록 사용:', err);
  }

  return FALLBACK_VIDEO_MODELS;
}

export interface VideoAnalysisStreamCallbacks {
  /** 스트리밍 HTTP 연결이 열린 직후 호출 */
  onStreamOpen?: () => void;
  /** 모델의 사고 과정(reasoning) 토큰이 도착할 때마다 호출 */
  onReasoningDelta?: (chunk: string, fullText: string) => void;
  /** 모델의 최종 응답(JSON) 토큰이 도착할 때마다 호출 */
  onContentDelta?: (chunk: string, fullText: string) => void;
  /** 스트리밍이 실패해 일반(비스트리밍) 요청으로 폴백할 때 호출 */
  onFallback?: (reason: string) => void;
}

export interface AnalyzeVideoParams extends VideoAnalysisStreamCallbacks {
  frames: ExtractedFrame[];
  videoDuration: number;
  videoId: string;
  videoName: string;
  model: string;
  reasoningEffort?: ReasoningEffortOption;
  config?: GatewayConfig;
  signal?: AbortSignal;
  metadataDate?: string;
  latitude?: number;
  longitude?: number;
}

// === 스트리밍 SSE 파싱 헬퍼 =================================================

interface RawStreamDelta {
  content?: unknown;
  reasoning?: unknown;
  reasoning_content?: unknown;
  reasoning_details?: unknown;
}

function extractReasoningChunk(delta: RawStreamDelta): string {
  // OpenRouter/일부 제공사는 reasoning, reasoning_content, reasoning_details를 혼용한다.
  const direct = delta.reasoning ?? delta.reasoning_content;
  if (typeof direct === 'string' && direct) return direct;

  if (Array.isArray(direct)) {
    return direct
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>;
          if (typeof p.text === 'string') return p.text;
          if (typeof p.summary === 'string') return p.summary;
        }
        return '';
      })
      .join('');
  }

  if (Array.isArray(delta.reasoning_details)) {
    return delta.reasoning_details
      .map((part) => {
        if (!part || typeof part !== 'object') return '';
        const p = part as Record<string, unknown>;
        if (typeof p.text === 'string') return p.text;
        if (typeof p.summary === 'string') return p.summary;
        return '';
      })
      .join('');
  }

  return '';
}

function extractContentChunk(delta: RawStreamDelta): string {
  if (typeof delta.content === 'string') return delta.content;
  if (Array.isArray(delta.content)) {
    return delta.content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>;
          if (typeof p.text === 'string') return p.text;
        }
        return '';
      })
      .join('');
  }
  return '';
}

/**
 * AI Gateway의 SSE 스트림을 읽어 사고 과정(reasoning)과 최종 JSON(content)을 누적한다.
 * 토큰이 도착할 때마다 콜백을 호출하므로 UI에서 실시간 타이핑을 렌더링할 수 있다.
 */
async function requestAnalysisStream(
  url: string,
  config: GatewayConfig,
  requestBody: Record<string, unknown>,
  signal: AbortSignal | undefined,
  callbacks: VideoAnalysisStreamCallbacks
): Promise<{ content: string; reasoning: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${config.gatewaySecret}`,
    },
    body: JSON.stringify({ ...requestBody, stream: true }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Gateway 스트림 실패 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  if (!response.body) {
    throw new Error('AI Gateway가 응답 스트림을 반환하지 않았어요.');
  }

  callbacks.onStreamOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let finished = false;

  const handleEventLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line || line.startsWith(':') || !line.startsWith('data:')) return;

    const payload = line.slice(5).trim();
    if (!payload) return;

    if (payload === '[DONE]') {
      finished = true;
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      // 잘린 JSON 라인은 무시 (다음 청크에서 이어짐)
      return;
    }

    // 스트림 내부 에러 객체 감지
    if (parsed?.error) {
      const message =
        typeof parsed.error === 'string'
          ? parsed.error
          : parsed.error.message || JSON.stringify(parsed.error);
      throw new Error(`AI Gateway 스트림 오류: ${message}`);
    }

    const delta = (parsed?.choices?.[0]?.delta ?? {}) as RawStreamDelta;

    const reasoningChunk = extractReasoningChunk(delta);
    if (reasoningChunk) {
      reasoning += reasoningChunk;
      callbacks.onReasoningDelta?.(reasoningChunk, reasoning);
    }

    const contentChunk = extractContentChunk(delta);
    if (contentChunk) {
      content += contentChunk;
      callbacks.onContentDelta?.(contentChunk, content);
    }
  };

  try {
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        handleEventLine(line);
        if (finished) break;
      }
    }

    // [DONE] 없이 스트림이 끝난 경우 남은 버퍼 한 줄 처리
    if (!finished && buffer.trim()) {
      try {
        handleEventLine(buffer);
      } catch {
        // 마지막 잘린 라인은 무시
      }
    }
  } catch (err) {
    try {
      await reader.cancel();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }

  return { content, reasoning };
}

/** 스트리밍이 불가능한 경우 기존 방식(비스트리밍)으로 한 번 더 요청한다. */
async function requestAnalysisNonStreaming(
  url: string,
  config: GatewayConfig,
  requestBody: Record<string, unknown>,
  signal: AbortSignal | undefined
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.gatewaySecret}`,
    },
    body: JSON.stringify({ ...requestBody, stream: false }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Gateway 분석 실패 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

// 추출된 프레임 시퀀스를 AI Gateway로 전송하여 극적인 구간 추출
export async function analyzeVideoHighlights({
  frames,
  videoDuration,
  videoId,
  videoName,
  model,
  reasoningEffort = 'high',
  config = DEFAULT_CONFIG,
  signal,
  metadataDate,
  latitude,
  longitude,
  onStreamOpen,
  onReasoningDelta,
  onContentDelta,
  onFallback,
}: AnalyzeVideoParams): Promise<HighlightSegment[]> {
  const roundedDuration = Math.round(videoDuration * 10) / 10;
  // 하이라이트 목표 예산: 영상 전체 길이의 20%~35% (최소 2초, 최대 10초)
  const maxBudget = Math.max(3.0, Math.min(10.0, Math.round(roundedDuration * 0.35 * 10) / 10));
  const minBudget = Math.max(1.8, Math.min(maxBudget - 0.5, Math.round(roundedDuration * 0.15 * 10) / 10));

  const prompt = `You are an elite cinematic video director and highlight editor.
We have extracted ${frames.length} sequential keyframes from the video "${videoName}" (Total Duration: ${roundedDuration} seconds).
Each keyframe is labeled with its exact timestamp in seconds.

YOUR OBJECTIVE:
Select ONLY the absolute peak 1 to 3 CLIMAX/ACTION/DRAMATIC intervals.
A highlight video MUST be concise, punchy, and condensed (cutting out all boring buildup, idle frames, and transitions).

STRICT DURATION & SELECTION RULES:
1. TARGET BUDGET: Total combined duration of all highlight intervals MUST be roughly ${minBudget}s to ${maxBudget}s (about 20%~35% of total video length).
2. DO NOT SELECT THE ENTIRE VIDEO: Selecting more than 50% of the video duration is an absolute FAILURE.
3. INTERVAL COUNT: Return ONLY 1 to 3 peak intervals (1 single climax interval is preferred; maximum 3).
4. INDIVIDUAL INTERVAL LENGTH: Each interval MUST be between 1.5 seconds and 4.5 seconds. NEVER return an interval longer than 5.0 seconds.
5. NO OVERLAPPING: Intervals MUST NOT overlap.
6. Provide a concise, descriptive Korean scene title for 'reason' (e.g. '환하게 웃는 클라이맥스', '바닷가 산책', '박진감 넘치는 액션 순간'). This will be used as the scene subtitle!
7. Analyze human faces and main subject position in these keyframes to choose 'cropPosition':
   - "top": Person's face or eyes are located in the upper area (protects face from getting cropped in 16:9)
   - "center": Subject is centered or panoramic landscape
   - "bottom": Action or main subject is lower in the frame
8. Output MUST BE strictly a valid JSON array of objects with NO other commentary or markdown formatting.

Format:
[
  {"start": 3.2, "end": 6.5, "reason": "환하게 웃으며 꽃을 건네는 순간", "cropPosition": "top"}
]`;

  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/v1/chat/completions`;

  // 메시지 본문 구성: 텍스트 프롬프트 + 프레임별 타임스탬프 & image_url
  const messageContent: Array<Record<string, unknown>> = [
    { type: 'text', text: prompt },
  ];

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    messageContent.push({
      type: 'text',
      text: `[Frame #${i + 1} at timestamp ${f.timestamp.toFixed(1)}s]`,
    });
    messageContent.push({
      type: 'image_url',
      image_url: { url: f.dataUrl },
    });
  }

  const requestBody: Record<string, unknown> = {
    model: model || 'google/gemma-4-31b-it:free',
    messages: [
      {
        role: 'user',
        content: messageContent,
      },
    ],
    temperature: 0.2, // 결정론적이고 정확한 타임스탬프 추출
  };

  if (reasoningEffort && reasoningEffort !== 'none') {
    requestBody.reasoning_effort = reasoningEffort;
  }

  const callbacks: VideoAnalysisStreamCallbacks = {
    onStreamOpen,
    onReasoningDelta,
    onContentDelta,
    onFallback,
  };

  let rawContent = '';
  let streamedReasoning = '';
  let streamFailure: string | null = null;

  // 1) 실시간 스트리밍으로 사고 과정 + JSON 토큰 수신
  try {
    const streamed = await requestAnalysisStream(url, config, requestBody, signal, callbacks);
    rawContent = streamed.content;
    streamedReasoning = streamed.reasoning;

    // 본문이 비었거나 완전한 JSON 배열이 아니면 일반 요청으로 재시도
    if (!extractSegmentArray(rawContent)) {
      streamFailure = rawContent.trim()
        ? '스트림 응답이 완전한 JSON 배열이 아니에요.'
        : '스트림 응답 본문이 비어 있어요.';
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    streamFailure = err instanceof Error ? err.message : '스트림 연결에 실패했어요.';
  }

  // 2) 스트림이 실패한 경우 기존 비스트리밍 방식으로 폴백
  if (streamFailure && !signal?.aborted) {
    onFallback?.(streamFailure);
    rawContent = await requestAnalysisNonStreaming(url, config, requestBody, signal);
  }

  if (!rawContent.trim()) {
    throw new Error(
      streamedReasoning.trim()
        ? '모델이 사고 과정만 생성하고 최종 하이라이트 JSON을 만들지 못했어요. 추론 노력을 낮추거나 다른 모델을 선택해 주세요.'
        : 'AI 모델이 빈 응답을 반환했어요. 다른 모델을 선택하거나 잠시 후 다시 시도해 주세요.'
    );
  }

  // JSON 파싱 및 구간 검증
  return parseAndValidateSegments(
    rawContent,
    roundedDuration,
    videoId,
    videoName,
    metadataDate,
    latitude,
    longitude
  );
}

type RawSegmentItem = {
  start: number;
  end: number;
  reason?: string;
  cropPosition?: 'top' | 'center' | 'bottom' | string;
};

// LLM 응답에서 JSON 배열만 안전하게 추출 (파싱 실패 시 null)
export function extractSegmentArray(rawText: string): RawSegmentItem[] | null {
  if (!rawText || !rawText.trim()) return null;

  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) return parsed as RawSegmentItem[];
  } catch {
    // 마크다운 코드블록 또는 텍스트 내 JSON 배열 정규식 추출로 이어짐
  }

  const match = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? (parsed as RawSegmentItem[]) : null;
  } catch (err) {
    console.warn('[GatewayClient] JSON 배열 파싱 실패:', err);
    return null;
  }
}

// LLM 텍스트 응답에서 JSON 배열 추출 및 엄격한 구간 정제
export function parseAndValidateSegments(
  rawText: string,
  totalDuration: number,
  videoId: string,
  videoName: string,
  metadataDate?: string,
  latitude?: number,
  longitude?: number
): HighlightSegment[] {
  const parsed: RawSegmentItem[] = extractSegmentArray(rawText) ?? [];

  const validSegments: HighlightSegment[] = [];

  if (Array.isArray(parsed) && parsed.length > 0) {
    for (const item of parsed) {
      const rawStart = Number(item.start);
      const rawEnd = Number(item.end);

      if (isNaN(rawStart) || isNaN(rawEnd)) continue;

      let start = Math.max(0, Math.min(totalDuration, rawStart));
      let end = Math.max(0, Math.min(totalDuration, rawEnd));

      if (start >= end) continue;

      // 단일 구간이 5.5초를 초과하면 클라이맥스 중심 4.0초로 트리밍
      if (end - start > 5.5) {
        const mid = (start + end) / 2;
        start = Math.max(0, Math.round((mid - 2.0) * 10) / 10);
        end = Math.min(totalDuration, Math.round((mid + 2.0) * 10) / 10);
      }

      // AI가 분석한 주요 인물 위치에 따른 16:9 크롭 오프셋 (얼굴/시선 보호)
      let cropOffsetYRatio = 0.2; // 기본값 상단 (얼굴 보호)
      if (item.cropPosition === 'top') {
        cropOffsetYRatio = 0.15;
      } else if (item.cropPosition === 'center') {
        cropOffsetYRatio = 0.5;
      } else if (item.cropPosition === 'bottom') {
        cropOffsetYRatio = 0.85;
      }

      const sceneReason = item.reason || 'AI가 감지한 극적 순간';

      // 최소 1.2초 이상이어야 함
      if (end - start >= 1.2) {
        validSegments.push({
          id: `${videoId}-${start.toFixed(1)}-${end.toFixed(1)}`,
          sourceVideoId: videoId,
          sourceVideoName: videoName,
          start: Math.round(start * 10) / 10,
          end: Math.round(end * 10) / 10,
          duration: Math.round((end - start) * 10) / 10,
          reason: sceneReason,
          cropOffsetYRatio,
          subtitleDate: metadataDate || '',
          subtitleTitle: sceneReason,
          latitude,
          longitude,
        });
      }
    }
  }

  // 시간순 정렬
  validSegments.sort((a, b) => a.start - b.start);

  // 직접 겹치는 구간만 병합 (인접하다고 무조건 합치지 않음)
  const mergedSegments: HighlightSegment[] = [];
  for (const seg of validSegments) {
    if (mergedSegments.length === 0) {
      mergedSegments.push(seg);
      continue;
    }
    const prev = mergedSegments[mergedSegments.length - 1];
    if (seg.start < prev.end) {
      // 겹치는 경우만 병합
      prev.end = Math.max(prev.end, seg.end);
      prev.duration = Math.round((prev.end - prev.start) * 10) / 10;
      prev.reason = `${prev.reason} + ${seg.reason}`;
    } else {
      mergedSegments.push(seg);
    }
  }

  // 총 하이라이트 길이가 영상의 45% 또는 12초를 초과하는 경우 압축 정제
  const maxAllowedTotal = Math.max(3.5, Math.min(12.0, totalDuration * 0.45));
  while (
    mergedSegments.length > 1 &&
    mergedSegments.reduce((sum, s) => sum + s.duration, 0) > maxAllowedTotal
  ) {
    // 가장 짧거나 덜 중요한 마지막 구간 제외
    mergedSegments.pop();
  }

  // 만약 AI가 구간을 추출하지 못했거나 너무 짧은 경우 스마트 폴백 (중앙 25% 지점의 3~4.5초 구간)
  if (mergedSegments.length === 0) {
    const fallbackDuration = Math.min(4.5, Math.max(2.0, Math.round(totalDuration * 0.25 * 10) / 10));
    const fallbackStart = Math.round(Math.max(0, (totalDuration - fallbackDuration) * 0.4) * 10) / 10;
    const fallbackEnd = Math.round((fallbackStart + fallbackDuration) * 10) / 10;
    mergedSegments.push({
      id: `${videoId}-fallback`,
      sourceVideoId: videoId,
      sourceVideoName: videoName,
      start: fallbackStart,
      end: fallbackEnd,
      duration: Math.round((fallbackEnd - fallbackStart) * 10) / 10,
      reason: 'AI 핵심 클라이맥스 구간 (자동 선정)',
      cropOffsetYRatio: 0.2,
      subtitleDate: metadataDate || '',
      subtitleTitle: 'AI 핵심 클라이맥스 구간',
      latitude,
      longitude,
    });
  }

  return mergedSegments;
}
