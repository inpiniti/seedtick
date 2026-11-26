import type { FreeModelMeta, GatewayConfig, ReasoningEffortOption, UserApiKeyConfig } from '../types/gateway.ts';
import type { ExtractedFrame, HighlightMode, HighlightSegment } from '../types/video.ts';
import {
  canonicalModelId,
  enrichModelMetrics,
  isGuardrailModel,
  type ModelPerfMetric,
} from './modelMetrics.ts';
import { getStoredUserApiKeyConfig, isByokActive } from './userApiKeyService.ts';
import {
  enqueueVideoToAnalyzerQueue,
  isAnalyzerQueueEnabled,
  pollVideoAnalysisFromQueue,
  type QueueJobUpdate,
} from './analyzerQueueService.ts';

// 같은 도메인의 /v1 리라이트(Vercel) 또는 개발 프록시(Vite)를 통해 게이트웨이를 호출한다.
// 크로스오리진 직접 호출은 프리플라이트마다 CORS 헤더가 맞는지에 따라 실패할 수 있어 기본값을 상대 경로로 둔다.
// 다른 호스트에 배포할 때는 VITE_GATEWAY_URL로 절대 URL을 지정하면 된다.
const configuredGatewayUrl = (import.meta.env.VITE_GATEWAY_URL as string | undefined)?.trim();
export const DEFAULT_GATEWAY_URL = configuredGatewayUrl
  ? configuredGatewayUrl.replace(/\/+$/, '')
  : '';

/**
 * 공용 무료 게이트웨이 시크릿.
 *
 * 주의: 이 값은 클라이언트 번들에 포함되므로 브라우저에서 추출할 수 있다.
 * 배포 시 VITE_GATEWAY_SECRET으로 자체 게이트웨이 시크릿을 주입해 교체할 수 있다.
 * 근본적인 해결은 서버 프록시(/v1 리라이트에서 시크릿 주입) + 게이트웨이侧
 * Origin/Turnstile·레이트 리밋 제한이며, 스트리밍 분석이 30초 이상 걸려
 * 에지 함수_timeout 제한에 걸릴 수 있어 현재는 문서화된 후속 과제로 남긴다.
 */
export const DEFAULT_GATEWAY_SECRET =
  (import.meta.env.VITE_GATEWAY_SECRET as string | undefined)?.trim() ||
  '377d4fa71b90fdbbd6eab6765f3050598de8c259ed86e615c9b18ae4ed63e8bd';

export const DEFAULT_CONFIG: GatewayConfig = {
  baseUrl: DEFAULT_GATEWAY_URL,
  gatewaySecret: DEFAULT_GATEWAY_SECRET,
};

// 대기열 서버가 잠들어 있거나 아직 배포되지 않은 경우,
// 매 영상마다 12초씩 기다리지 않도록 실패 후 60초간 직접 호출로 동작한다.
let queueCooldownUntil = 0;

// 다중 프레임 시각 분석을 공식 지원하는 고성능 모델 목록 (비상시 폴백, 지능 지수순)
export const FALLBACK_VIDEO_MODELS: FreeModelMeta[] = [
  {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'NVIDIA: Nemotron 3.5 Super VL',
    providerName: 'NVIDIA',
    contextLengthFormatted: '1M tokens (초대용량)',
    description: 'NVIDIA Nemotron 3.5 Super VL is an open multimodal MoE model with 12B active parameters out of 120B total. Takes text, images, docs, GUI screenshots, and video.',
    modality: 'text+image+video->text',
    inputModalities: ['text', 'image', 'video'],
    intelligenceIndex: 13.6,
    codingIndex: null,
    agenticIndex: null,
    speedTokensPerSecond: 82,
    latencyMs: 1500,
    intelligenceTier: '플래그십 멀티모달 & 1M 윈도우',
    parametersSummary: '120B (활성 12B)',
  },
  {
    id: 'thinkingmachines/inkling-small:free',
    name: 'Thinking Machines: Inkling Small',
    providerName: 'Thinking Machines',
    contextLengthFormatted: '256K tokens',
    description: '초대형 멀티모달 고지능 추론 모델로 연속 프레임 시퀀스와 타임스탬프 분석에 탁월합니다.',
    modality: 'text+image+audio->text',
    inputModalities: ['text', 'image', 'audio'],
    intelligenceIndex: 12.9,
    codingIndex: 52.9,
    agenticIndex: null,
    speedTokensPerSecond: 208,
    latencyMs: 1600,
    intelligenceTier: '최상위 지능 멀티모달',
    parametersSummary: '276B (활성 12B)',
  },
  {
    id: 'thinkingmachines/inkling:free',
    name: 'Thinking Machines: Inkling',
    providerName: 'Thinking Machines',
    contextLengthFormatted: '256K tokens',
    description: '975B MoE 최첨단 고지능 비전 추론 모델입니다.',
    modality: 'text+image+audio->text',
    inputModalities: ['text', 'image', 'audio'],
    intelligenceIndex: 12.5,
    codingIndex: 52.1,
    agenticIndex: null,
    speedTokensPerSecond: 194,
    latencyMs: 1750,
    intelligenceTier: '초대형 975B 고지능 MoE',
    parametersSummary: '975B (활성 41B)',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA: Nemotron 3 Nano Omni',
    providerName: 'NVIDIA',
    contextLengthFormatted: '256K tokens',
    description: '텍스트와 이미지를 통합 인식하는 옴니 멀티모달 추론 모델입니다.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceIndex: null,
    codingIndex: 13.8,
    agenticIndex: null,
    speedTokensPerSecond: 90,
    latencyMs: 605,
    intelligenceTier: '옴니 멀티모달 추론',
    parametersSummary: '30B (활성 3B)',
  },
  {
    id: 'dots-studio/dots-3-note-preview:free',
    name: 'Dots Studio: Dots3-Note Preview',
    providerName: 'Dots Studio',
    contextLengthFormatted: '512K tokens',
    description: '280B MoE 고지능 비전 모델로 복합 장면 시퀀스 요약에 최적화되어 있습니다.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceIndex: null,
    codingIndex: null,
    agenticIndex: null,
    speedTokensPerSecond: 30,
    latencyMs: 6500,
    intelligenceTier: '초대형 280B 비전 MoE',
    parametersSummary: '280B (활성 16B)',
  },
];

/**
 * OpenRouter 공개 프론트엔드 API에서 실시간 엔드포인트 속도(Throughput) 및 레이턴시(TTFT) 메트릭을 수신한다.
 */
export async function fetchOpenRouterLivePerf(): Promise<Map<string, ModelPerfMetric>> {
  const map = new Map<string, ModelPerfMetric>();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://openrouter.ai/api/frontend/v1/models/find?max_price=0', {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      const perfMap = json.data?.endpoint_perf || {};
      const models = Array.isArray(json.data?.models) ? json.data.models : [];
      for (const m of models) {
        const epId = m.endpoint?.id;
        const perf = epId ? perfMap[epId] : null;

        const rawDataPolicy =
          m.endpoint?.provider_info?.dataPolicy ||
          m.endpoint?.data_policy ||
          m.data_policy;

        const dataPolicy = rawDataPolicy
          ? {
              training: typeof rawDataPolicy.training === 'boolean' ? rawDataPolicy.training : undefined,
              trainingOpenRouter:
                typeof rawDataPolicy.trainingOpenRouter === 'boolean'
                  ? rawDataPolicy.trainingOpenRouter
                  : undefined,
              retainsPrompts:
                typeof rawDataPolicy.retainsPrompts === 'boolean'
                  ? rawDataPolicy.retainsPrompts
                  : undefined,
              retentionDays:
                typeof rawDataPolicy.retentionDays === 'number'
                  ? rawDataPolicy.retentionDays
                  : rawDataPolicy.prompt_retention_days ?? null,
              safetyRetention:
                typeof rawDataPolicy.safetyRetention === 'boolean'
                  ? rawDataPolicy.safetyRetention
                  : undefined,
            }
          : undefined;

        const speed =
          perf?.p50_throughput != null && Number.isFinite(perf.p50_throughput)
            ? Math.round(perf.p50_throughput)
            : null;
        const latency =
          perf?.p50_latency != null && Number.isFinite(perf.p50_latency)
            ? Math.round(perf.p50_latency)
            : null;

        if (speed != null || latency != null || dataPolicy != null) {
          const entry: ModelPerfMetric = {
            speedTokensPerSecond: speed ?? 0,
            latencyMs: latency ?? 0,
            dataPolicy,
          };
          if (m.slug) {
            map.set(canonicalModelId(m.slug), entry);
            map.set(m.slug, entry);
            map.set(`${m.slug}:free`, entry);
          }
          if (m.endpoint?.model_variant_slug) {
            map.set(canonicalModelId(m.endpoint.model_variant_slug), entry);
            map.set(m.endpoint.model_variant_slug, entry);
          }
        }
      }
    }
  } catch {
    // 실시간 메트릭 조회 실패 시 기본 벤치마크 fallback 사용
  }
  return map;
}

// 게이트웨이에서 이미지/비전 입력 가능한 멀티모달 모델 가져오기
export async function fetchVideoCapableModels(config: GatewayConfig = DEFAULT_CONFIG): Promise<FreeModelMeta[]> {
  const [gatewayModels, livePerf] = await Promise.all([
    (async () => {
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
            // 안전성 가드레일 모델은 하이라이트 분석용이 아니므로 제외한다.
            const visionModels = json.data.filter((m: FreeModelMeta) => {
              // Google Gemma 모델 제외 (오류 빈발로 제외)
              const isGoogleGemma =
                m.id.toLowerCase().includes('gemma') ||
                m.name.toLowerCase().includes('gemma');
              if (isGoogleGemma) return false;

              const hasImageInput = Array.isArray(m.inputModalities) && m.inputModalities.includes('image');
              const hasImageModality = typeof m.modality === 'string' && m.modality.includes('image');
              const isKnownVision =
                m.id.includes('super-vl') ||
                m.id.includes('nano-omni') ||
                m.id.includes('dots-3') ||
                m.id.includes('inkling');
              const isVision = hasImageInput || hasImageModality || isKnownVision;
              return isVision && !isGuardrailModel(m);
            });

            if (visionModels.length > 0) {
              return visionModels;
            }
          }
        }
      } catch (err) {
        console.warn('[GatewayClient] 비전 모델 조회 실패, 기본 폴백 목록 사용:', err);
      }
      return null;
    })(),
    fetchOpenRouterLivePerf(),
  ]);

  const targetModels = (gatewayModels && gatewayModels.length > 0) ? gatewayModels : FALLBACK_VIDEO_MODELS;
  return enrichModelMetrics(targetModels, livePerf);
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
  /** 스트림/요청 활성 데이터 수신 시 호출 (백그라운드 복귀 및 와치독 검사용) */
  onActivity?: () => void;
  /** 자체 분석 대기열의 순번/진행률이 갱신될 때 호출 */
  onQueueUpdate?: (info: QueueJobUpdate) => void;
  /** 대기열을 사용할 수 없어 기존 게이트웨이 직접 호출로 전환할 때 호출 */
  onQueueFallback?: (reason: string) => void;
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
  locationName?: string;
  locale?: string;
  userApiKeyConfig?: UserApiKeyConfig | null;
  /**
   * 자체 분석 대기열(reportist-analyzer)을 사용할지 여부.
   * 기본값 true. 대기열이 응답하지 않으면 자동으로 기존 게이트웨이 직접 호출로 폴백한다.
   */
  useQueue?: boolean;
  /** 하이라이트 생성 방식 (기본: story - 기존 감성 하이라이트) */
  highlightMode?: HighlightMode;
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
  callbacks: VideoAnalysisStreamCallbacks,
  customHeaders: Record<string, string> = {}
): Promise<{ content: string; reasoning: string }> {
  // 백그라운드 탭 전환 시 소켓이 끊기거나 응답이 영구 정체(Stall)되는 것을 방지하기 위한 워치독 타임아웃
  const CHUNK_INACTIVITY_TIMEOUT_MS = 25000; // 청크 미수신 최대 허용 시간 (25초)
  const TOTAL_STREAM_TIMEOUT_MS = 85000; // 단일 스트림 전체 최대 허용 시간 (85초)

  // 스트림 전체 타임아웃 컨트롤러
  const streamAbortController = new AbortController();
  const onParentAbort = () => streamAbortController.abort();
  if (signal) {
    if (signal.aborted) streamAbortController.abort();
    else signal.addEventListener('abort', onParentAbort, { once: true });
  }

  const totalTimer = setTimeout(() => {
    streamAbortController.abort(new Error('AI Gateway 스트림 응답 전체 시간 초과(85초)'));
  }, TOTAL_STREAM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${config.gatewaySecret}`,
        ...customHeaders,
      },
      body: JSON.stringify({ ...requestBody, stream: true }),
      signal: streamAbortController.signal,
    });
  } catch (fetchErr) {
    clearTimeout(totalTimer);
    if (signal) signal.removeEventListener('abort', onParentAbort);
    throw fetchErr;
  }

  if (!response.ok) {
    clearTimeout(totalTimer);
    if (signal) signal.removeEventListener('abort', onParentAbort);
    const errorText = await response.text();
    throw new Error(`AI Gateway 스트림 실패 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  if (!response.body) {
    clearTimeout(totalTimer);
    if (signal) signal.removeEventListener('abort', onParentAbort);
    throw new Error('AI Gateway가 응답 스트림을 반환하지 않았어요.');
  }

  callbacks.onStreamOpen?.();
  callbacks.onActivity?.();

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
      callbacks.onActivity?.();
    }

    const contentChunk = extractContentChunk(delta);
    if (contentChunk) {
      content += contentChunk;
      callbacks.onContentDelta?.(contentChunk, content);
      callbacks.onActivity?.();
    }
  };

  try {
    while (!finished) {
      if (signal?.aborted) {
        throw new Error('사용자에 의해 작업이 취소되었습니다.');
      }

      // 청크 비활성 감지(Inactivity Watchdog): 백그라운드 전환 등으로 연결이 끊기면 25초 내 감지
      let chunkTimer: ReturnType<typeof setTimeout> | null = null;
      const inactivityPromise = new Promise<never>((_, reject) => {
        chunkTimer = setTimeout(() => {
          reject(new Error('AI Gateway 응답 패킷이 25초 이상 수신되지 않아 자동 복구(재시도)로 전환합니다.'));
        }, CHUNK_INACTIVITY_TIMEOUT_MS);
      });

      let readResult: ReadableStreamReadResult<Uint8Array>;
      try {
        readResult = await Promise.race([reader.read(), inactivityPromise]);
      } finally {
        if (chunkTimer) clearTimeout(chunkTimer);
      }

      const { done, value } = readResult;
      if (done) break;

      callbacks.onActivity?.();
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
    clearTimeout(totalTimer);
    if (signal) signal.removeEventListener('abort', onParentAbort);
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
  signal: AbortSignal | undefined,
  customHeaders: Record<string, string> = {}
): Promise<string> {
  const NON_STREAM_TIMEOUT_MS = 45000;
  const timeoutController = new AbortController();
  const onParentAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) timeoutController.abort();
    else signal.addEventListener('abort', onParentAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timeoutController.abort(new Error('AI Gateway 비스트리밍 요청 시간 초과(45초)'));
  }, NON_STREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.gatewaySecret}`,
        ...customHeaders,
      },
      body: JSON.stringify({ ...requestBody, stream: false }),
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI Gateway 분석 실패 (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onParentAbort);
  }
}

// 1초 컷 편집 모드에서 영상 길이에 맞춰 권장하는 컷 개수 범위
export function getQuickCutTargetCountRange(totalDuration: number): { min: number; max: number } {
  const safe = Number.isFinite(totalDuration) && totalDuration > 0 ? totalDuration : 0;
  if (safe < 8) return { min: 1, max: 2 };
  if (safe < 20) return { min: 2, max: 4 };
  if (safe < 45) return { min: 4, max: 7 };
  if (safe < 90) return { min: 6, max: 10 };
  return { min: 8, max: 12 };
}

// 추출된 프레임 시퀀스를 AI Gateway로 전송하여 극적인 구간 추출
export async function analyzeVideoHighlights({
  frames,
  videoDuration,
  videoId,
  videoName,
  model,
  // 컷 타임스탬프 JSON 추출에는 장문 thinking이 불필요하므로 기본 추론 강도를 낮춘다.
  reasoningEffort = 'low',
  config = DEFAULT_CONFIG,
  signal,
  metadataDate,
  latitude,
  longitude,
  locationName,
  locale = 'en',
  userApiKeyConfig,
  onStreamOpen,
  onReasoningDelta,
  onContentDelta,
  onFallback,
  onActivity,
  onQueueUpdate,
  onQueueFallback,
  useQueue = true,
  highlightMode = 'story',
}: AnalyzeVideoParams): Promise<HighlightSegment[]> {
  const rawDuration =
    Number.isFinite(videoDuration) && videoDuration > 0
      ? videoDuration
      : frames.length > 0
      ? Math.max(
          1.0,
          Math.max(...frames.map((f) => (Number.isFinite(f.timestamp) ? f.timestamp : 0))) + 0.5
        )
      : 3.0;
  const roundedDuration = Math.round(rawDuration * 10) / 10;
  const isQuickCut = highlightMode === 'quick-cut';

  // 로컬 폴백 명시 호출 시 네트워크 요청 없이 즉시 결정론적 컷을 생성한다.
  if (model === 'smart-local-fallback') {
    return parseAndValidateSegments(
      '',
      roundedDuration,
      videoId,
      videoName,
      metadataDate,
      latitude,
      longitude,
      locationName,
      highlightMode
    );
  }

  const quickCutRange = getQuickCutTargetCountRange(roundedDuration);
  const isShortStoryClip = roundedDuration <= 4.0;
  const isShortQuickClip = roundedDuration <= 2.6;

  // 하이라이트 목표 예산
  // - story: 일반 영상은 20%~35% (최소 2초, 최대 10초), 4초 이하 짧은 클립은 최소 1컷이 성립하도록 유연 조정
  // - quick-cut: 권장 컷 수(≈1초)에 맞춘 0.9~1.15배 (최대 15초)
  const storyMinInterval = isShortStoryClip
    ? Math.min(1.0, Math.max(0.5, Math.round(roundedDuration * 0.4 * 10) / 10))
    : 1.5;
  const storyMaxInterval = isShortStoryClip
    ? Math.min(3.5, Math.max(storyMinInterval, Math.round(roundedDuration * 0.85 * 10) / 10))
    : 4.5;
  const quickMinInterval = isShortQuickClip
    ? Math.min(0.8, Math.max(0.4, Math.round(roundedDuration * 0.4 * 10) / 10))
    : 0.8;
  const quickMaxInterval = isShortQuickClip
    ? Math.min(1.3, Math.max(quickMinInterval, Math.round(roundedDuration * 0.85 * 10) / 10))
    : 1.3;

  const maxBudget = isQuickCut
    ? isShortQuickClip
      ? quickMaxInterval
      : Math.max(1.2, Math.min(15.0, Math.round(quickCutRange.max * 1.15 * 10) / 10))
    : isShortStoryClip
    ? storyMaxInterval
    : Math.max(3.0, Math.min(10.0, Math.round(roundedDuration * 0.35 * 10) / 10));
  const minBudget = isQuickCut
    ? isShortQuickClip
      ? quickMinInterval
      : Math.max(0.8, Math.min(maxBudget - 0.4, Math.round(quickCutRange.min * 0.9 * 10) / 10))
    : isShortStoryClip
    ? storyMinInterval
    : Math.max(1.8, Math.min(maxBudget - 0.5, Math.round(roundedDuration * 0.15 * 10) / 10));

  const getLanguageRule = (loc?: string) => {
    switch (loc) {
      case 'ko':
        return `6. Provide a natural, warm vlog-style scene title in Korean for 'reason' (e.g. '카드 쥐고 신나게 움직이기', '케이크 묻히고 활짝 웃는 얼굴', '조심조심 걷다가 털썩!'). NEVER use robotic clichés like '클라이맥스', '순간', '장면', '액션 순간', '최고의 순간'! This will be directly shown as the vlog subtitle.
7. Suggest a catchy, attractive YouTube title in Korean for 'videoTitle' (e.g. '눈부신 바다와 함께한 찬란한 하루', '우리들의 소중한 일상 하이라이트').`;
      case 'ja':
        return `6. Provide a natural, engaging vlog caption in Japanese for 'reason' (e.g. 'カードを持って楽しそうに動く', 'ケーキをほおばる笑顔', 'よちよち歩いて座り込む'). NEVER use robotic phrases like 'クライマックス', '瞬間', 'シーン'! This will be used as the scene subtitle!
7. Suggest an attractive YouTube title in Japanese for 'videoTitle'.`;
      case 'zh':
        return `6. Provide a natural, warm vlog-style scene title in Chinese for 'reason' (e.g. '抓着卡片兴奋地挥动', '沾着蛋糕灿烂微笑', '摇摇晃晃走着坐下'). NEVER use robotic words like '高光时刻', '瞬间', '高潮'! This will be used as the scene subtitle!
7. Suggest an attractive YouTube title in Chinese for 'videoTitle'.`;
      case 'es':
        return `6. Provide a natural, lively vlog caption in Spanish for 'reason' (e.g. 'Moviéndose emocionado con la tarjeta', 'Sonrisa radiante con pastel', 'Caminando con cuidado y sentándose'). NEVER use robotic clichés like 'clímax', 'momento cumbre'!
7. Suggest an attractive YouTube title in Spanish for 'videoTitle'.`;
      case 'fr':
        return `6. Provide a natural, charming vlog caption in French for 'reason' (e.g. 'S\\'agitant joyeusement avec la carte', 'Sourire éclatant plein de gâteau', 'Marchant doucement avant de s\\'asseoir'). NEVER use robotic clichés like 'climax', 'moment fort'!
7. Suggest an attractive YouTube title in French for 'videoTitle'.`;
      case 'de':
        return `6. Provide a natural, lively vlog caption in German for 'reason' (e.g. 'Begeistert mit der Karte in der Hand', 'Strahlendes Lächeln mit Kuchen', 'Vorsichtig gelaufen und hingesetzt'). NEVER use robotic words like 'Höhepunkt', 'Moment'!
7. Suggest an attractive YouTube title in German for 'videoTitle'.`;
      default:
        return `6. Provide a natural, warm vlog caption for 'reason' (e.g. 'Excitedly waving the card', 'Bright cake-covered smile', 'Waddling along and plopping down'). NEVER use robotic clichés like 'climax', 'action moment', 'peak scene'! This will be used as the scene subtitle!
7. Suggest a catchy, attractive YouTube title for 'videoTitle' (e.g. 'Golden Hours and Precious Memories').`;
    }
  };

  const storyDurationRule = isShortStoryClip
    ? `1. TARGET BUDGET (SHORT CLIP): Because this clip is short (${roundedDuration}s), pick the single best highlight interval of ${minBudget}s to ${maxBudget}s.\n2. MANDATORY MINIMUM: The user explicitly uploaded this clip to include it in their video. You MUST return AT LEAST 1 interval in 'segments' — NEVER return an empty 'segments' array.`
    : `1. TARGET BUDGET: Total combined duration of all highlight intervals MUST be roughly ${minBudget}s to ${maxBudget}s (about 20%~35% of total video length).\n2. DO NOT SELECT THE ENTIRE VIDEO: Selecting more than 50% of the video duration is an absolute FAILURE.`;

  const storyPrompt = `You are an elite cinematic video director and highlight editor.
We have extracted ${frames.length} sequential keyframes from the video "${videoName}" (Total Duration: ${roundedDuration} seconds).
Each keyframe is labeled with its exact timestamp in seconds.

YOUR OBJECTIVE:
Select ONLY the absolute peak 1 to 3 CLIMAX/ACTION/DRAMATIC intervals.
A highlight video MUST be concise, punchy, and condensed (cutting out all boring buildup, idle frames, and transitions).

STRICT DURATION & SELECTION RULES:
${storyDurationRule}
3. INTERVAL COUNT (MANDATORY >= 1): Return 1 to 3 peak intervals (1 single climax interval is preferred; maximum 3). NEVER return an empty 'segments' array — the user uploaded this clip to use it, so AT LEAST 1 interval MUST be returned.
4. INDIVIDUAL INTERVAL LENGTH: Each interval MUST be between ${storyMinInterval} seconds and ${storyMaxInterval} seconds. NEVER return an interval longer than 5.0 seconds.
5. NO OVERLAPPING: Intervals MUST NOT overlap.
${getLanguageRule(locale)}
8. Analyze human faces and main subject position in these keyframes to choose 'cropPosition' (for vertical source videos that get cropped into a wide 16:9 frame):
   - "top": Person's face or eyes are located in the upper area (protects face from getting cropped in 16:9)
   - "center": Subject is centered or panoramic landscape
   - "bottom": Action or main subject is lower in the frame
   And choose 'horizontalPosition' (for horizontal source videos that get cropped into a tall 9:16 frame):
   - "left": Person's face or main subject is on the LEFT side of the frame
   - "center": Subject is centered or the scene is symmetric/panoramic
   - "right": Person's face or main subject is on the RIGHT side of the frame
9. THUMBNAIL DIRECT RECOMMENDATION:
   Carefully inspect all keyframes and choose the single absolute best, clearest, most emotional, and photogenic keyframe moment for the YouTube thumbnail.
   - 'bestThumbnailTimestamp': exact timestamp (seconds) of that single best keyframe.
   - 'bestThumbnailReason': a concise phrase in the requested language explaining why this frame was chosen as the thumbnail (e.g. '가장 생동감 넘치고 환하게 웃는 표정', '압도적인 액션의 결정적 순간').
10. Output MUST BE strictly valid JSON with NO commentary or markdown formatting.

Format:
{
  "videoTitle": "Catchy YouTube Video Title",
  "bestThumbnailTimestamp": 3.8,
  "bestThumbnailReason": "가장 생동감 넘치고 환하게 웃는 표정",
  "segments": [
    {"start": 3.2, "end": 6.5, "reason": "Joyful smiling climax", "cropPosition": "top", "horizontalPosition": "center"}
  ]
}`;

  const quickCutBudgetRule = isShortQuickClip
    ? `4. TARGET BUDGET (SHORT CLIP): Because this clip is short (${roundedDuration}s), pick 1 best cut of ${minBudget}s to ${maxBudget}s. NEVER return an empty 'segments' array.`
    : `4. TARGET BUDGET: Total combined duration MUST be roughly ${minBudget}s to ${maxBudget}s. Selecting more than 50% of the video duration is an absolute FAILURE.`;

  const quickCutPrompt = `You are an elite quick-cut montage editor.
We have extracted ${frames.length} sequential keyframes from the video "${videoName}" (Total Duration: ${roundedDuration} seconds).
Each keyframe is labeled with its exact timestamp in seconds.

YOUR OBJECTIVE:
Build a fast, rhythmic 1-second-cut highlight montage from the most distinct, expressive, and visually interesting moments.
A short video may only produce 1-2 cuts, but a longer video MUST produce more cuts (up to 12) instead of one long scene.

STRICT DURATION & SELECTION RULES:
1. INTERVAL COUNT (MANDATORY >= 1): Return between ${quickCutRange.min} and ${quickCutRange.max} intervals for this ${roundedDuration}-second video. NEVER return an empty 'segments' array — the user uploaded this clip to use it, so AT LEAST 1 interval MUST be returned. Never collapse a long video into only 1-2 cuts either.
2. INDIVIDUAL INTERVAL LENGTH: Each interval MUST be between ${quickMinInterval} seconds and ${quickMaxInterval} seconds. Aim for ~1.0 second. NEVER return an interval longer than 1.5 seconds.
3. SPACING: Each interval MUST start at least 1.5 seconds after the previous interval ends. Never pick near-identical consecutive frames from the same action.
${quickCutBudgetRule}
5. VARIETY: Choose visibly different moments — a change in expression, an action transition, a shift in gaze or composition, a new subject, or a punchy reaction.
6. NO OVERLAPPING: Intervals MUST NOT overlap.
CAPTION STYLE FOR 1-SECOND CUTS:
- 'reason' is shown directly as the on-screen subtitle. Keep it to 2-4 words (short enough to read within one second).
${getLanguageRule(locale)}
8. Analyze human faces and main subject position in these keyframes to choose 'cropPosition' (for vertical source videos that get cropped into a wide 16:9 frame):
   - "top": Person's face or eyes are located in the upper area (protects face from getting cropped in 16:9)
   - "center": Subject is centered or panoramic landscape
   - "bottom": Action or main subject is lower in the frame
   And choose 'horizontalPosition' (for horizontal source videos that get cropped into a tall 9:16 frame):
   - "left": Person's face or main subject is on the LEFT side of the frame
   - "center": Subject is centered or the scene is symmetric/panoramic
   - "right": Person's face or main subject is on the RIGHT side of the frame
9. THUMBNAIL DIRECT RECOMMENDATION:
   Carefully inspect all keyframes and choose the single absolute best, clearest, most emotional, and photogenic keyframe moment for the YouTube thumbnail.
   - 'bestThumbnailTimestamp': exact timestamp (seconds) of that single best keyframe.
   - 'bestThumbnailReason': a concise phrase in the requested language explaining why this frame was chosen as the thumbnail (e.g. '가장 생동감 넘치고 환하게 웃는 표정', '압도적인 액션의 결정적 순간').
10. Output MUST BE strictly valid JSON with NO commentary or markdown formatting.

Format:
{
  "videoTitle": "Catchy YouTube Video Title",
  "bestThumbnailTimestamp": 3.8,
  "bestThumbnailReason": "가장 생동감 넘치고 환하게 웃는 표정",
  "segments": [
    {"start": 3.2, "end": 4.2, "reason": "Joyful smile", "cropPosition": "top", "horizontalPosition": "center"},
    {"start": 7.8, "end": 8.8, "reason": "Tiny happy steps", "cropPosition": "center", "horizontalPosition": "center"}
  ]
}`;

  const prompt = isQuickCut ? quickCutPrompt : storyPrompt;

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

  // 사용자 직접 입력 API 키(BYOK) 확인
  // 명시적으로 전달된 설정은 항상 사용하고, 로컬 스토리지 설정은 BYOK 모드가 활성일 때만 사용한다.
  // 무료 게이트웨이 모델을 선택한 뒤에는 저장된 키가 있어도 선택한 모델로 분석한다.
  const activeUserKeyConfig = userApiKeyConfig !== undefined
    ? userApiKeyConfig
    : (isByokActive() ? getStoredUserApiKeyConfig() : null);
  const customHeaders: Record<string, string> = {};
  const hasUserKey = Boolean(activeUserKeyConfig?.apiKey?.trim());

  const defaultModelId = FALLBACK_VIDEO_MODELS[0]?.id || 'thinkingmachines/inkling-small:free';
  const effectiveModel = hasUserKey
    ? (activeUserKeyConfig?.model?.trim() || model || 'gpt-4o-mini')
    : (model || defaultModelId);

  // ── 자체 분석 대기열(reportist-analyzer) 우선 시도 ──
  // BYOK 사용자는 본인 키로 직접 호출해야 하므로 대기열을 건너뛴다.
  if (useQueue && !hasUserKey && isAnalyzerQueueEnabled() && Date.now() >= queueCooldownUntil) {
    let enqueuedJobId: string | null = null;
    try {
      const enqueued = await enqueueVideoToAnalyzerQueue({
        videoName,
        videoDuration: roundedDuration,
        frames,
        locale,
        model: effectiveModel,
        prompt,
        reasoningEffort,
        priority: 10,
        signal,
      });
      enqueuedJobId = enqueued.job_id;

      onQueueUpdate?.({
        jobId: enqueued.job_id,
        status: enqueued.status,
        queuePosition: enqueued.queue_position,
        estimatedWaitSec: enqueued.estimated_wait_sec,
        progress: enqueued.progress || 0,
        message: enqueued.progress_message,
      });

      const { analysis } = await pollVideoAnalysisFromQueue({
        jobId: enqueued.job_id,
        signal,
        onActivity,
        onQueueUpdate,
      });

      const hasUsableAnalysis =
        Boolean(analysis) &&
        (Boolean(analysis?.rawText) ||
          (Array.isArray(analysis?.segments) && analysis!.segments!.length > 0));
      if (!hasUsableAnalysis) {
        throw new Error('대기열 응답에 사용할 수 있는 분석 결과가 없습니다.');
      }

      const rawQueueContent = analysis?.rawText
        ? analysis.rawText
        : JSON.stringify(analysis);

      return parseAndValidateSegments(
        rawQueueContent,
        roundedDuration,
        videoId,
        videoName,
        metadataDate,
        latitude,
        longitude,
        locationName,
        highlightMode
      );
    } catch (queueErr: unknown) {
      if (signal?.aborted) throw queueErr;

      // 등록 자체가 실패한 경우(서버 슬립/미배포/네트워크)에만 잠시 대기열을 비활성화한다.
      if (!enqueuedJobId) {
        queueCooldownUntil = Date.now() + 60_000;
      }

      const reason = queueErr instanceof Error ? queueErr.message : String(queueErr);
      console.warn('[GatewayClient] 분석 대기열 사용 불가, 게이트웨이 직접 호출로 전환:', reason);
      onQueueFallback?.(reason);
    }
  }

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

  const callbacks: VideoAnalysisStreamCallbacks = {
    onStreamOpen,
    onReasoningDelta,
    onContentDelta,
    onFallback,
    onActivity,
  };

  // 모델 후보군 구성: 사용자 키인 경우 해당 모델 1개만 시도, 게이트웨이 무료인 경우 폴백 모델 순환
  const fallbackModelIds = FALLBACK_VIDEO_MODELS.map((m) => m.id);
  const candidateModels = hasUserKey
    ? [effectiveModel]
    : Array.from(new Set([effectiveModel, ...fallbackModelIds])).slice(0, 3);

  let rawContent = '';
  let streamedReasoning = '';
  let lastError: Error | null = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    if (signal?.aborted) break;

    const currentModel = candidateModels[mIdx];
    const isRetry = mIdx > 0;
    if (isRetry) {
      const nextModelName = currentModel.replace(':free', '');
      onFallback?.(
        `AI 게이트웨이 일시 과부하/지연 감지로 대체 모델(${nextModelName})로 자동 전환합니다.`
      );
      // 짧은 지수 백오프
      await new Promise((r) => setTimeout(r, 600));
      if (signal?.aborted) break;
    }

    const requestBody: Record<string, unknown> = {
      model: currentModel,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
      temperature: 0.2,
      // P0: 루프 밖 공통 requestBody와 동일하게 ZDR(데이터 미보관) 플래그를 유지해야 한다.
      // 이전에는 루프 안 requestBody가 이를 덮어써 랜딩의 프라이버시 약속이 깨졌다.
      data_collection: 'deny',
      zdr: true,
    };

    if (reasoningEffort && reasoningEffort !== 'none') {
      requestBody.reasoning_effort = reasoningEffort;
    }

    let streamFailure: string | null = null;
    let isServerUnavailable = false;

    // 1) 실시간 스트리밍 시도
    const hasNonEmptySegments = (text: string): boolean => {
      const arr = extractSegmentArray(text);
      return Array.isArray(arr) && arr.length > 0;
    };

    try {
      const streamed = await requestAnalysisStream(url, config, requestBody, signal, callbacks, customHeaders);
      rawContent = streamed.content;
      streamedReasoning = streamed.reasoning;

      // 본문이 비었거나 유효한 구간이 1개도 없으면 일반 요청으로 재시도
      if (!hasNonEmptySegments(rawContent)) {
        streamFailure = rawContent.trim()
          ? '스트림 응답에 유효한 하이라이트 구간이 없어요.'
          : '스트림 응답 본문이 비어 있어요.';
      } else {
        // 성공적으로 유효한 JSON 세그먼트를 획득함!
        break;
      }
    } catch (err: unknown) {
      if (signal?.aborted) throw err;
      const errMsg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(errMsg);

      // 503, 502, 504, 429, 네트워크 단절, 스트림 정체(Stall), 타임아웃 판별
      if (
        errMsg.includes('503') ||
        errMsg.includes('502') ||
        errMsg.includes('504') ||
        errMsg.includes('429') ||
        errMsg.includes('overloaded') ||
        errMsg.includes('rate limit') ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('NetworkError') ||
        errMsg.includes('지연') ||
        errMsg.includes('시간 초과') ||
        errMsg.includes('Stall') ||
        errMsg.includes('timeout')
      ) {
        isServerUnavailable = true;
        console.warn(`[GatewayClient] 모델 ${currentModel} 서버 과부하/네트워크 지연 감지 -> 다음 대체 모델로 전환 시도`);
        continue;
      }

      streamFailure = errMsg;
    }

    // 2) 스트림이 실패한 경우 (503이 아닌 JSON 파싱이나 스트림 단절 등의 경우) 동일 모델로 비스트리밍 폴백
    if (!isServerUnavailable && streamFailure && !signal?.aborted) {
      try {
        onFallback?.(streamFailure);
        rawContent = await requestAnalysisNonStreaming(url, config, requestBody, signal, customHeaders);
        if (hasNonEmptySegments(rawContent)) {
          // 비스트리밍으로 성공!
          break;
        }
      } catch (nbErr: unknown) {
        if (signal?.aborted) throw nbErr;
        const nbMsg = nbErr instanceof Error ? nbErr.message : String(nbErr);
        lastError = nbErr instanceof Error ? nbErr : new Error(nbMsg);
        console.warn(`[GatewayClient] 모델 ${currentModel} 비스트리밍 요청 실패:`, nbMsg);
      }
    }
  }

  // 3) 모든 AI 모델 시도 실패 시: 영상 제작 파이프라인 중단 방지를 위한 스마트 로컬 폴백 자동 적용
  const finalRawSegments = extractSegmentArray(rawContent);
  if (!rawContent.trim() || !Array.isArray(finalRawSegments) || finalRawSegments.length === 0) {
    console.warn(
      '[GatewayClient] AI 모델 응답 획득 실패 (503 또는 타임아웃). 최적 스마트 로컬 클라이맥스 구간으로 자동 복구합니다.',
      lastError
    );
    onFallback?.(
      'AI 게이트웨이 일시 장애(503)로 인해 최적 스마트 로컬 클라이맥스 구간으로 자동 대체 구성했습니다.'
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
    longitude,
    locationName,
    highlightMode
  );
}

type RawSegmentItem = {
  start: number;
  end: number;
  reason?: string;
  cropPosition?: 'top' | 'center' | 'bottom' | string;
  horizontalPosition?: 'left' | 'center' | 'right' | string;
};

export interface ParsedAnalysisPayload {
  videoTitle?: string;
  bestThumbnailTimestamp?: number;
  bestThumbnailReason?: string;
  segments: RawSegmentItem[];
}

// LLM 응답에서 JSON 객체 또는 배열을 안전하게 추출
export function extractAnalysisData(rawText: string): ParsedAnalysisPayload | null {
  if (!rawText || !rawText.trim()) return null;

  // 1. 순수 JSON 파싱 시도
  try {
    const parsed = JSON.parse(rawText.trim());
    if (Array.isArray(parsed)) {
      return { segments: parsed as RawSegmentItem[] };
    }
    if (parsed && typeof parsed === 'object') {
      const segs = Array.isArray(parsed.segments) ? parsed.segments : [];
      return {
        videoTitle: typeof parsed.videoTitle === 'string' ? parsed.videoTitle : typeof parsed.title === 'string' ? parsed.title : undefined,
        bestThumbnailTimestamp: typeof parsed.bestThumbnailTimestamp === 'number' ? parsed.bestThumbnailTimestamp : undefined,
        bestThumbnailReason: typeof parsed.bestThumbnailReason === 'string' ? parsed.bestThumbnailReason.trim() : typeof parsed.thumbnailReason === 'string' ? parsed.thumbnailReason.trim() : undefined,
        segments: segs as RawSegmentItem[],
      };
    }
  } catch {
    // regex fallback
  }

  // 2. 객체 매칭: { ... "segments": [ ... ] ... }
  const objMatch = rawText.match(/\{[\s\S]*"segments"\s*:\s*\[[\s\S]*\][\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed && typeof parsed === 'object') {
        const segs = Array.isArray(parsed.segments) ? parsed.segments : [];
        return {
          videoTitle: typeof parsed.videoTitle === 'string' ? parsed.videoTitle : typeof parsed.title === 'string' ? parsed.title : undefined,
          bestThumbnailTimestamp: typeof parsed.bestThumbnailTimestamp === 'number' ? parsed.bestThumbnailTimestamp : undefined,
          bestThumbnailReason: typeof parsed.bestThumbnailReason === 'string' ? parsed.bestThumbnailReason.trim() : typeof parsed.thumbnailReason === 'string' ? parsed.thumbnailReason.trim() : undefined,
          segments: segs as RawSegmentItem[],
        };
      }
    } catch {
      // ignore
    }
  }

  // 3. 배열 매칭: [ { ... } ]
  const arrMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed)) {
        return { segments: parsed as RawSegmentItem[] };
      }
    } catch (err) {
      console.warn('[GatewayClient] JSON 배열 파싱 실패:', err);
    }
  }

  return null;
}

// 기존 호환성을 위한 extractSegmentArray
export function extractSegmentArray(rawText: string): RawSegmentItem[] | null {
  const data = extractAnalysisData(rawText);
  return data ? data.segments : null;
}

// LLM 텍스트 응답에서 JSON 배열 추출 및 엄격한 구간 정제
export function parseAndValidateSegments(
  rawText: string,
  totalDuration: number,
  videoId: string,
  videoName: string,
  metadataDate?: string,
  latitude?: number,
  longitude?: number,
  locationName?: string,
  highlightMode: HighlightMode = 'story'
): HighlightSegment[] {
  const safeDuration =
    Number.isFinite(totalDuration) && totalDuration > 0
      ? Math.max(0.2, Math.round(totalDuration * 10) / 10)
      : 3.0;
  const analysisData = extractAnalysisData(rawText);
  const parsed: RawSegmentItem[] = analysisData?.segments ?? [];
  const isQuickCut = highlightMode === 'quick-cut';

  // story는 기본 1.2초, 1초 컷 모드는 기본 0.6초. 짧은 클립(<= 3.5s)은 비율에 맞춰 유연하게 허용한다.
  const minSegmentDuration = isQuickCut
    ? Math.min(0.6, Math.max(0.2, Math.round(safeDuration * 0.35 * 10) / 10))
    : Math.min(1.2, Math.max(0.4, Math.round(safeDuration * 0.35 * 10) / 10));

  const validSegments: HighlightSegment[] = [];
  let bestShortCandidate: HighlightSegment | null = null;

  if (Array.isArray(parsed) && parsed.length > 0) {
    for (const item of parsed) {
      const rawStart = Number(item.start);
      const rawEnd = Number(item.end);

      if (isNaN(rawStart) || isNaN(rawEnd)) continue;

      let start = Math.max(0, Math.min(safeDuration, rawStart));
      let end = Math.max(0, Math.min(safeDuration, rawEnd));

      if (start >= end) continue;

      if (isQuickCut) {
        // 1초 컷 모드: AI가 1.5초 넘게 길게 반환하면 중앙 기준 1.0초로 자동 트리밍
        if (end - start > 1.6) {
          const mid = (start + end) / 2;
          start = Math.max(0, Math.min(Math.max(0, safeDuration - 0.1), Math.round((mid - 0.5) * 10) / 10));
          end = Math.min(safeDuration, Math.round((start + 1.0) * 10) / 10);
        }
      } else if (end - start > 5.5) {
        // 감성 하이라이트: 단일 구간이 5.5초를 초과하면 클라이맥스 중심 4.0초로 트리밍
        const mid = (start + end) / 2;
        start = Math.max(0, Math.round((mid - 2.0) * 10) / 10);
        end = Math.min(safeDuration, Math.round((mid + 2.0) * 10) / 10);
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

      // AI가 분석한 주요 인물의 가로 위치 (가로 원본 → 세로 9:16 크롭에 사용)
      let cropOffsetXRatio = 0.5; // 기본값 중앙
      if (item.horizontalPosition === 'left') {
        cropOffsetXRatio = 0.15;
      } else if (item.horizontalPosition === 'right') {
        cropOffsetXRatio = 0.85;
      }

      const sceneReason = item.reason || 'AI가 감지한 극적 순간';
      const roundedStart = Math.round(start * 10) / 10;
      const roundedEnd = Math.min(safeDuration, Math.round(end * 10) / 10);
      const segDuration = Math.round((roundedEnd - roundedStart) * 10) / 10;
      if (segDuration <= 0) continue;

      const candidate: HighlightSegment = {
        id: `${videoId}-${roundedStart.toFixed(1)}-${roundedEnd.toFixed(1)}`,
        sourceVideoId: videoId,
        sourceVideoName: videoName,
        start: roundedStart,
        end: roundedEnd,
        duration: segDuration,
        reason: sceneReason,
        cropOffsetYRatio,
        cropOffsetXRatio,
        subtitleDate: metadataDate || '',
        subtitleTitle: sceneReason,
        locationName,
        latitude,
        longitude,
      };

      if (segDuration >= minSegmentDuration) {
        validSegments.push(candidate);
      } else if (!bestShortCandidate || candidate.duration > bestShortCandidate.duration) {
        bestShortCandidate = candidate;
      }
    }
  }

  // AI가 반환한 구간이 모두 최소 길이보다 살짝 짧았던 경우, 가장 긴 AI 후보를 최소 길이로 확장해 자막/크롭을 보존한다.
  if (validSegments.length === 0 && bestShortCandidate) {
    const targetDur = Math.min(safeDuration, minSegmentDuration);
    const mid = (bestShortCandidate.start + bestShortCandidate.end) / 2;
    const expandedStart = Math.max(
      0,
      Math.min(Math.max(0, safeDuration - targetDur), Math.round((mid - targetDur / 2) * 10) / 10)
    );
    const expandedEnd = Math.min(safeDuration, Math.round((expandedStart + targetDur) * 10) / 10);
    const expandedDuration = Math.round((expandedEnd - expandedStart) * 10) / 10;
    if (expandedDuration > 0) {
      validSegments.push({
        ...bestShortCandidate,
        id: `${videoId}-${expandedStart.toFixed(1)}-${expandedEnd.toFixed(1)}`,
        start: expandedStart,
        end: expandedEnd,
        duration: expandedDuration,
      });
    }
  }

  // 시간순 정렬
  validSegments.sort((a, b) => a.start - b.start);

  const mergedSegments: HighlightSegment[] = [];
  if (isQuickCut) {
    // 1초 컷 모드: 겹치거나 너무 가까운(0.6초 미만 간격) 컷은 중복 장면으로 보고 버린다.
    const MIN_QUICK_CUT_GAP = 0.6;
    for (const seg of validSegments) {
      const prev = mergedSegments[mergedSegments.length - 1];
      if (prev && seg.start < prev.end + MIN_QUICK_CUT_GAP) continue;
      mergedSegments.push(seg);
    }
  } else {
    // 직접 겹치는 구간만 병합 (인접하다고 무조건 합치지 않음)
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
  }

  // 총 하이라이트 길이 상한
  // - story: 영상의 45% 또는 12초
  // - quick-cut: 1초 컷을 여러 개 유지할 수 있도록 영상의 50% 또는 15초
  const maxAllowedTotal = isQuickCut
    ? Math.max(2.0, Math.min(15.0, safeDuration * 0.5))
    : Math.max(3.5, Math.min(12.0, safeDuration * 0.45));
  while (
    mergedSegments.length > 1 &&
    mergedSegments.reduce((sum, s) => sum + s.duration, 0) > maxAllowedTotal
  ) {
    // 가장 짧거나 덜 중요한 마지막 구간 제외 (최소 1개 구간은 항상 유지)
    mergedSegments.pop();
  }

  // 만약 AI가 구간을 추출하지 못했거나 너무 짧은 경우 스마트 폴백 (영상당 최소 1컷 보장)
  if (mergedSegments.length === 0) {
    if (isQuickCut) {
      // 1초 컷 폴백: 영상 길이에 비례해 균등 간격의 1초 컷을 자동 생성한다.
      const range = getQuickCutTargetCountRange(safeDuration);
      const estimatedCount = Math.max(1, Math.ceil(safeDuration / 6));
      const fallbackCount = Math.max(range.min, Math.min(range.max, estimatedCount));
      const minQuickFallback = Math.min(0.5, Math.max(0.1, Math.round(safeDuration * 0.4 * 10) / 10));
      const fallbackClipDuration = Math.min(
        safeDuration,
        Math.max(minQuickFallback, Math.min(1.0, Math.round(safeDuration * 0.6 * 10) / 10))
      );
      const step = safeDuration / fallbackCount;

      for (let i = 0; i < fallbackCount; i++) {
        const rawStart = i * step + step / 2 - fallbackClipDuration / 2;
        const fallbackStart = Math.max(
          0,
          Math.min(
            Math.max(0, safeDuration - fallbackClipDuration),
            Math.round(rawStart * 10) / 10
          )
        );
        const fallbackEnd = Math.min(
          safeDuration,
          Math.round((fallbackStart + fallbackClipDuration) * 10) / 10
        );
        if (fallbackEnd - fallbackStart < minQuickFallback) continue;

        mergedSegments.push({
          id: `${videoId}-quick-${i + 1}`,
          sourceVideoId: videoId,
          sourceVideoName: videoName,
          start: fallbackStart,
          end: fallbackEnd,
          duration: Math.round((fallbackEnd - fallbackStart) * 10) / 10,
          reason: 'AI 1초 컷 (자동 선정)',
          cropOffsetYRatio: 0.2,
          cropOffsetXRatio: 0.5,
          subtitleDate: metadataDate || '',
          subtitleTitle: 'AI 1초 컷 (자동 선정)',
          locationName,
          latitude,
          longitude,
        });
      }
    } else {
      const minStoryFallback = Math.min(2.0, Math.max(0.2, Math.round(safeDuration * 0.6 * 10) / 10));
      const fallbackDuration = Math.min(
        safeDuration,
        Math.min(4.5, Math.max(minStoryFallback, Math.round(safeDuration * 0.25 * 10) / 10))
      );
      const fallbackStart = Math.max(
        0,
        Math.min(
          Math.max(0, safeDuration - fallbackDuration),
          Math.round(Math.max(0, (safeDuration - fallbackDuration) * 0.4) * 10) / 10
        )
      );
      const fallbackEnd = Math.min(
        safeDuration,
        Math.round((fallbackStart + fallbackDuration) * 10) / 10
      );
      if (fallbackEnd > fallbackStart) {
        mergedSegments.push({
          id: `${videoId}-fallback`,
          sourceVideoId: videoId,
          sourceVideoName: videoName,
          start: fallbackStart,
          end: fallbackEnd,
          duration: Math.round((fallbackEnd - fallbackStart) * 10) / 10,
          reason: 'AI 핵심 클라이맥스 구간 (자동 선정)',
          cropOffsetYRatio: 0.2,
          cropOffsetXRatio: 0.5,
          subtitleDate: metadataDate || '',
          subtitleTitle: 'AI 핵심 클라이맥스 구간',
          locationName,
          latitude,
          longitude,
        });
      }
    }
  }

  // 최종 안전망: 어떤 극단적인 영상 길이/응답에서도 업로드된 영상당 최소 1컷은 반드시 보장한다.
  if (mergedSegments.length === 0) {
    const guaranteedEnd = Math.max(0.1, safeDuration);
    mergedSegments.push({
      id: `${videoId}-guaranteed`,
      sourceVideoId: videoId,
      sourceVideoName: videoName,
      start: 0,
      end: guaranteedEnd,
      duration: Math.round(guaranteedEnd * 10) / 10,
      reason: isQuickCut ? 'AI 1초 컷 (자동 선정)' : 'AI 핵심 클라이맥스 구간 (자동 선정)',
      cropOffsetYRatio: 0.2,
      cropOffsetXRatio: 0.5,
      subtitleDate: metadataDate || '',
      subtitleTitle: isQuickCut ? 'AI 1초 컷 (자동 선정)' : 'AI 핵심 클라이맥스 구간',
      locationName,
      latitude,
      longitude,
    });
  }

  // AI 추천 타이틀 및 썸네일 타임스탬프 메타데이터 첨부
  const resolvedTitle =
    analysisData?.videoTitle?.trim() ||
    mergedSegments[0]?.subtitleTitle ||
    mergedSegments[0]?.reason ||
    videoName.replace(/\.[^/.]+$/, '');

  const resolvedThumbTime =
    typeof analysisData?.bestThumbnailTimestamp === 'number'
      ? Math.max(0, Math.min(safeDuration, analysisData.bestThumbnailTimestamp))
      : mergedSegments[0]
      ? Math.round((mergedSegments[0].start + mergedSegments[0].duration * 0.35) * 10) / 10
      : 0;

  const resolvedThumbReason =
    analysisData?.bestThumbnailReason?.trim() ||
    mergedSegments[0]?.subtitleTitle ||
    mergedSegments[0]?.reason ||
    'AI가 추천한 베스트 순간';

  Object.assign(mergedSegments, {
    suggestedTitle: resolvedTitle,
    bestThumbnailTimestamp: resolvedThumbTime,
    bestThumbnailReason: resolvedThumbReason,
  });

  return mergedSegments;
}
