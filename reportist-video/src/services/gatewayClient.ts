// services/gatewayClient.ts - AI Gateway 통신 및 비디오 극적 구간 분석 서비스

import type { FreeModelMeta, GatewayConfig, ReasoningEffortOption } from '../types/gateway.ts';
import type { HighlightSegment } from '../types/video.ts';

export const DEFAULT_GATEWAY_URL = 'https://seedtick-ai-gateway.vercel.app';
export const DEFAULT_GATEWAY_SECRET = '377d4fa71b90fdbbd6eab6765f3050598de8c259ed86e615c9b18ae4ed63e8bd';

export const DEFAULT_CONFIG: GatewayConfig = {
  baseUrl: DEFAULT_GATEWAY_URL,
  gatewaySecret: DEFAULT_GATEWAY_SECRET,
};

// 비디오 입력을 공식 지원하는 무료 모델 폴백 목록
export const FALLBACK_VIDEO_MODELS: FreeModelMeta[] = [
  {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'NVIDIA: Nemotron 3.5 Super VL (free)',
    providerName: 'NVIDIA',
    contextLengthFormatted: '1M tokens (초대용량)',
    description: '120B MoE 오픈 멀티모달 모델. 텍스트, 이미지, GUI, 비디오 입력을 완벽하게 지원합니다.',
    modality: 'text+image+video->text',
    inputModalities: ['text', 'image', 'video'],
    intelligenceTier: '플래그십 비디오 멀티모달',
    supportedEfforts: ['high', 'medium', 'low'],
    defaultEffort: 'high',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google: Gemma 4 31B (free)',
    providerName: 'Google DeepMind',
    contextLengthFormatted: '256K tokens',
    description: 'Google DeepMind의 고성능 멀티모달 모델로 비디오 타임스탬프 분석 및 추론에 탁월합니다.',
    modality: 'text+image+video->text',
    inputModalities: ['text', 'image', 'video'],
    intelligenceTier: 'Google 31B 멀티모달',
    supportedEfforts: ['high', 'medium', 'low'],
    defaultEffort: 'high',
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google: Gemma 4 26B A4B (free)',
    providerName: 'Google DeepMind',
    contextLengthFormatted: '256K tokens',
    description: 'Google DeepMind 경량 고성능 MoE 모델로 빠른 비디오 장면 인식이 가능합니다.',
    modality: 'text+image+video->text',
    inputModalities: ['text', 'image', 'video'],
    intelligenceTier: 'Google 경량 고성능 MoE',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA: Nemotron 3 Nano Omni (free)',
    providerName: 'NVIDIA',
    contextLengthFormatted: '256K tokens',
    description: '텍스트, 이미지, 오디오, 비디오를 통합 인식하는 옴니 멀티모달 모델입니다.',
    modality: 'text+image+audio+video->text',
    inputModalities: ['text', 'image', 'audio', 'video'],
    intelligenceTier: '옴니 멀티모달 추론',
  },
];

// 게이트웨이에서 비디오 입력 가능한 모델만 가져오기
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
        // 비디오 모달리티를 지원하는 모델만 엄격 필터링
        const videoModels = json.data.filter((m: FreeModelMeta) => {
          const hasVideoInput = Array.isArray(m.inputModalities) && m.inputModalities.includes('video');
          const hasVideoModality = typeof m.modality === 'string' && m.modality.includes('video');
          const isKnownVideo = m.id.includes('super-vl') || m.id.includes('nano-omni') || m.id.includes('gemma-4');
          return hasVideoInput || hasVideoModality || isKnownVideo;
        });

        if (videoModels.length > 0) {
          return videoModels;
        }
      }
    }
  } catch (err) {
    console.warn('[GatewayClient] 비디오 모델 조회 실패, 기본 폴백 목록 사용:', err);
  }

  return FALLBACK_VIDEO_MODELS;
}

export interface AnalyzeVideoParams {
  videoDataUrl: string;
  videoDuration: number;
  videoId: string;
  videoName: string;
  model: string;
  reasoningEffort?: ReasoningEffortOption;
  config?: GatewayConfig;
  signal?: AbortSignal;
}

// 비디오를 AI Gateway로 전송하여 극적인 구간 추출
export async function analyzeVideoHighlights({
  videoDataUrl,
  videoDuration,
  videoId,
  videoName,
  model,
  reasoningEffort = 'high',
  config = DEFAULT_CONFIG,
  signal,
}: AnalyzeVideoParams): Promise<HighlightSegment[]> {
  const roundedDuration = Math.round(videoDuration * 10) / 10;
  
  const prompt = `You are an elite cinematic video director and highlight editor.
Analyze the provided video (Total Duration: ${roundedDuration} seconds) and identify the most DRAMATIC, EXCITING, EMOTIONAL, or PEAK ACTION highlight moments.

CRITICAL RULES:
1. Return 1 to 5 most dramatic intervals.
2. Each interval duration MUST be at least 1.0 second (end - start >= 1.0).
3. Intervals MUST NOT overlap with each other.
4. Timestamps must be within 0.0 to ${roundedDuration} seconds.
5. Provide a short, captivating Korean description for 'reason' (e.g. '결정적인 득점 순간', '박진감 넘치는 액션 시퀀스', '감동적인 클라이맥스 표정').
6. Output MUST BE strictly a valid JSON array of objects with NO other commentary or markdown formatting.

Format:
[
  {"start": 1.2, "end": 4.5, "reason": "화려한 기술과 반전이 일어나는 클라이맥스 장면"}
]`;

  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/v1/chat/completions`;

  const requestBody: Record<string, unknown> = {
    model: model || 'nvidia/nemotron-3.5-super-vl:free',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'video_url',
            video_url: { url: videoDataUrl },
          },
        ],
      },
    ],
    temperature: 0.2, // 결정론적이고 정확한 타임스탬프 추출
  };

  if (reasoningEffort && reasoningEffort !== 'none') {
    requestBody.reasoning_effort = reasoningEffort;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.gatewaySecret}`,
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Gateway 분석 실패 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const result = await response.json();
  const rawContent = result.choices?.[0]?.message?.content || '';

  // JSON 파싱 및 구간 검증
  return parseAndValidateSegments(rawContent, roundedDuration, videoId, videoName);
}

// LLM 텍스트 응답에서 JSON 배열 추출 및 엄격한 구간 정제
export function parseAndValidateSegments(
  rawText: string,
  totalDuration: number,
  videoId: string,
  videoName: string
): HighlightSegment[] {
  let parsed: Array<{ start: number; end: number; reason?: string }> = [];

  try {
    // 1. 순수 JSON 파싱 시도
    parsed = JSON.parse(rawText);
  } catch {
    // 2. 마크다운 코드블록 또는 텍스트 내 JSON 배열 정규식 추출
    const match = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (e) {
        console.warn('[GatewayClient] 정규식 JSON 파싱 실패:', e);
      }
    }
  }

  const validSegments: HighlightSegment[] = [];

  if (Array.isArray(parsed) && parsed.length > 0) {
    for (const item of parsed) {
      const rawStart = Number(item.start);
      const rawEnd = Number(item.end);

      if (isNaN(rawStart) || isNaN(rawEnd)) continue;

      const start = Math.max(0, Math.min(totalDuration, rawStart));
      const end = Math.max(0, Math.min(totalDuration, rawEnd));

      // 최소 1.0초 이상이어야 함
      if (end - start >= 1.0) {
        validSegments.push({
          id: `${videoId}-${start.toFixed(1)}-${end.toFixed(1)}`,
          sourceVideoId: videoId,
          sourceVideoName: videoName,
          start: Math.round(start * 10) / 10,
          end: Math.round(end * 10) / 10,
          duration: Math.round((end - start) * 10) / 10,
          reason: item.reason || 'AI가 감지한 극적 순간',
        });
      }
    }
  }

  // 시간순 정렬
  validSegments.sort((a, b) => a.start - b.start);

  // 겹치거나 인접한 구간 병합
  const mergedSegments: HighlightSegment[] = [];
  for (const seg of validSegments) {
    if (mergedSegments.length === 0) {
      mergedSegments.push(seg);
      continue;
    }
    const prev = mergedSegments[mergedSegments.length - 1];
    if (seg.start <= prev.end + 0.3) {
      // 겹치거나 0.3초 이내로 바로 이어지는 경우 병합
      prev.end = Math.max(prev.end, seg.end);
      prev.duration = Math.round((prev.end - prev.start) * 10) / 10;
      prev.reason = `${prev.reason} + ${seg.reason}`;
    } else {
      mergedSegments.push(seg);
    }
  }

  // 만약 AI가 구간을 추출하지 못했거나 영상이 너무 짧은 경우 스마트 폴백
  if (mergedSegments.length === 0) {
    const fallbackStart = totalDuration > 4 ? Math.round(totalDuration * 0.2 * 10) / 10 : 0;
    const fallbackEnd = totalDuration > 4 ? Math.round(totalDuration * 0.8 * 10) / 10 : totalDuration;
    mergedSegments.push({
      id: `${videoId}-fallback`,
      sourceVideoId: videoId,
      sourceVideoName: videoName,
      start: fallbackStart,
      end: fallbackEnd,
      duration: Math.round((fallbackEnd - fallbackStart) * 10) / 10,
      reason: 'AI 주요 관심 구간 (자동 선정)',
    });
  }

  return mergedSegments;
}
