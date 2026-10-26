// services/api.ts - Gateway API 호출 및 모델 캐시 서비스

import type { FreeModelMeta, GatewayConfig, ReasoningEffortOption } from '../types/chat.ts';

export const DEFAULT_GATEWAY_URL = 'https://seedtick-ai-gateway.vercel.app';

// URL 정규화: 프로토콜 누락(예: seedtick-ai-gateway.vercel.app), 잘못된 호스트 결합, 후행 슬래시 등 자동 보정
export function normalizeBaseUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) {
    return DEFAULT_GATEWAY_URL;
  }
  let url = rawUrl.trim();

  // 이전 세션에서 잘못 합성된 URL 보정 (예: reportist-chat.vercel.app/seedtick-ai-gateway.vercel.app)
  if (url.includes('reportist-chat.vercel.app/seedtick-ai-gateway.vercel.app')) {
    return DEFAULT_GATEWAY_URL;
  }

  // 끝에 슬래시 제거
  url = url.replace(/\/+$/, '');

  // 프로토콜이 누락된 경우 (seedtick-ai-gateway.vercel.app 등)
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith('localhost') || url.startsWith('127.0.0.1')) {
      url = `http://${url}`;
    } else {
      url = `https://${url}`;
    }
  }

  return url;
}

// 게이트웨이 기본 설정
export const DEFAULT_CONFIG: GatewayConfig = {
  baseUrl: DEFAULT_GATEWAY_URL,
  gatewaySecret: '377d4fa71b90fdbbd6eab6765f3050598de8c259ed86e615c9b18ae4ed63e8bd',
};

const STORAGE_KEY_CONFIG = 'reportist_chat_gateway_config';

export function loadGatewayConfig(): GatewayConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      const cfg = { ...DEFAULT_CONFIG, ...parsed };
      cfg.baseUrl = normalizeBaseUrl(cfg.baseUrl);
      return cfg;
    }
  } catch (e) {
    console.error('Failed to load gateway config:', e);
  }
  return DEFAULT_CONFIG;
}

export function saveGatewayConfig(config: GatewayConfig): void {
  try {
    const normalized: GatewayConfig = {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl),
    };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(normalized));
  } catch (e) {
    console.error('Failed to save gateway config:', e);
  }
}

// 오프라인/게이트웨이 미실행 시에도 100% 즉시 표시되는 17개 무료 모델 폴백 데이터
export const FALLBACK_FREE_MODELS: FreeModelMeta[] = [
  {
    id: 'recursive/flint-v1.0:free',
    name: 'Recursive: Flint (free)',
    providerName: 'Recursive',
    created: 1792627200,
    createdDate: '2026-10-21',
    daysAgo: 5,
    contextLength: 262144,
    contextLengthFormatted: '256K tokens',
    description: "Flint is an open-weight mixture-of-experts model from Recursive, with about 2.5B active parameters out of 40B total, built by Recursive's autoresearch system Eureka Machine for coding agents.",
    modality: 'text->text',
    intelligenceTier: '코딩 에이전트 특화 MoE',
    parametersSummary: '40B (활성 2.5B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'xingchen-agi/xing4.0-29b-a4b:free',
    name: 'XingChen: Xing4.0 29B A4B (free)',
    providerName: 'XingChen (TeleAI)',
    created: 1792195200,
    createdDate: '2026-10-16',
    daysAgo: 10,
    contextLength: 262144,
    contextLengthFormatted: '256K tokens',
    description: 'Xing4.0-29B-A4B is an open-weight mixture-of-experts language model from China Telecom AI team (TeleAI). It has 29B total parameters with 4B active per token.',
    modality: 'text->text',
    intelligenceTier: '다목적 고성능 MoE',
    parametersSummary: '29B (활성 4B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'nvidia/nemotron-3.5-super-vl:free',
    name: 'NVIDIA: Nemotron 3.5 Super VL (free)',
    providerName: 'NVIDIA',
    created: 1792108800,
    createdDate: '2026-10-15',
    daysAgo: 11,
    contextLength: 1000000,
    contextLengthFormatted: '1M tokens (초대용량)',
    description: 'NVIDIA Nemotron 3.5 Super VL is an open multimodal MoE model with 12B active parameters out of 120B total. Takes text, images, docs, GUI screenshots, and video.',
    modality: 'text+image+video->text',
    intelligenceTier: '플래그십 120B 멀티모달 & 1M 윈도우',
    parametersSummary: '120B (활성 12B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'dots-studio/dots-3-note-preview:free',
    name: 'Dots Studio: Dots3-Note Preview (free)',
    providerName: 'Dots Studio',
    created: 1786752000,
    createdDate: '2026-08-14',
    daysAgo: 73,
    contextLength: 512000,
    contextLengthFormatted: '512K tokens',
    description: 'Dots3-Note Preview is an open-weight MoE model with 16B active parameters out of 280B total. Suited for long-form reasoning and note summarization.',
    modality: 'text+image->text',
    intelligenceTier: '초대형 280B 심층 추론 MoE',
    parametersSummary: '280B (활성 16B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'liquid/lfm-2.5-2.6b:free',
    name: 'LiquidAI: LFM2.5-2.6B (free)',
    providerName: 'Liquid AI',
    created: 1786492800,
    createdDate: '2026-08-11',
    daysAgo: 76,
    contextLength: 65536,
    contextLengthFormatted: '64K tokens',
    description: 'LFM2.5-2.6B is a compact reasoning model from Liquid AI. Suited for fast agent workflows and lightweight inference.',
    modality: 'text->text',
    intelligenceTier: '초경량 초고속 추론',
    parametersSummary: '2.6B',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'NVIDIA: Nemotron 3.5 Lightning (free)',
    providerName: 'NVIDIA',
    created: 1786492800,
    createdDate: '2026-08-11',
    daysAgo: 76,
    contextLength: 1000000,
    contextLengthFormatted: '1M tokens (초대용량)',
    description: 'NVIDIA Nemotron 3.5 Lightning is an open MoE model with 3B active parameters out of 30B total, designed for high-throughput agentic workloads.',
    modality: 'text->text',
    intelligenceTier: '초고속 에이전트 MoE',
    parametersSummary: '30B (활성 3B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'thinkingmachines/inkling-small:free',
    name: 'Thinking Machines: Inkling Small (free)',
    providerName: 'Thinking Machines Lab',
    created: 1785456000,
    createdDate: '2026-07-30',
    daysAgo: 88,
    contextLength: 1048576,
    contextLengthFormatted: '1M tokens',
    description: 'Inkling Small is an open multimodal MoE model with 12B active parameters out of 276B total. High-efficiency reasoning and tool usage.',
    modality: 'text+image+audio->text',
    intelligenceTier: '멀티모달 276B MoE',
    parametersSummary: '276B (활성 12B)',
    supportedParameters: ['reasoning', 'reasoning_effort', 'temperature', 'tools'],
  },
  {
    id: 'poolside/laguna-s-2.1:free',
    name: 'Poolside: Laguna S 2.1 (free)',
    providerName: 'Poolside',
    created: 1784678400,
    createdDate: '2026-07-21',
    daysAgo: 97,
    contextLength: 262144,
    contextLengthFormatted: '256K tokens',
    description: 'Laguna S 2.1 is a top-tier coding agent model with 118B total parameters and 8B active parameters, scoring 70.2% on Terminal-Bench.',
    modality: 'text->text',
    intelligenceTier: '최상위 코딩 에이전트 118B',
    parametersSummary: '118B (활성 8B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'thinkingmachines/inkling:free',
    name: 'Thinking Machines: Inkling (free)',
    providerName: 'Thinking Machines Lab',
    created: 1784332800,
    createdDate: '2026-07-17',
    daysAgo: 101,
    contextLength: 1048576,
    contextLengthFormatted: '1M tokens',
    description: 'Inkling is a mammoth 975B MoE model (41B active) designed for general-purpose frontier reasoning, coding, and tool-use.',
    modality: 'text+image+audio->text',
    intelligenceTier: '플래그십 거대 975B MoE',
    parametersSummary: '975B (활성 41B)',
    supportedParameters: ['reasoning', 'reasoning_effort', 'temperature', 'tools'],
  },
  {
    id: 'poolside/laguna-xs-2.1:free',
    name: 'Poolside: Laguna XS 2.1 (free)',
    providerName: 'Poolside',
    created: 1783036800,
    createdDate: '2026-07-02',
    daysAgo: 116,
    contextLength: 262144,
    contextLengthFormatted: '256K tokens',
    description: 'Laguna XS 2.1 is an efficient 33B-A3B coding model optimized for fast interactive software engineering.',
    modality: 'text->text',
    intelligenceTier: '경량 고속 코딩 MoE',
    parametersSummary: '33B (활성 3B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'cohere/north-mini-code:free',
    name: 'Cohere: North Mini Code (free)',
    providerName: 'Cohere',
    created: 1781740800,
    createdDate: '2026-06-17',
    daysAgo: 131,
    contextLength: 256000,
    contextLengthFormatted: '256K tokens',
    description: "North Mini Code is Cohere's first agentic coding model. Sparse MoE with 30B total and 3B active parameters.",
    modality: 'text->text',
    intelligenceTier: 'Cohere 코딩 에이전트',
    parametersSummary: '30B (활성 3B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'nvidia/nemotron-3.5-content-safety:free',
    name: 'NVIDIA: Nemotron 3.5 Content Safety (free)',
    providerName: 'NVIDIA',
    created: 1780617600,
    createdDate: '2026-06-04',
    daysAgo: 144,
    contextLength: 128000,
    contextLengthFormatted: '128K tokens',
    description: 'NVIDIA Nemotron 3.5 Content Safety is a compact 4B-parameter multimodal guardrail model fine-tuned from Gemma-3-4B.',
    modality: 'text+image->text',
    intelligenceTier: '안전성 검증 & 필터링',
    parametersSummary: '4B',
    supportedParameters: ['reasoning', 'temperature'],
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'NVIDIA: Nemotron 3 Ultra (free)',
    providerName: 'NVIDIA',
    created: 1780588800,
    createdDate: '2026-06-04',
    daysAgo: 144,
    contextLength: 1000000,
    contextLengthFormatted: '1M tokens (초대용량)',
    description: 'NVIDIA Nemotron 3 Ultra is an open frontier reasoning model with 55B active out of 550B total parameters (Transformer-Mamba MoE).',
    modality: 'text->text',
    intelligenceTier: '플래그십 550B 프론티어 추론',
    parametersSummary: '550B (활성 55B)',
    supportedParameters: ['reasoning', 'reasoning_effort', 'temperature', 'tools'],
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'NVIDIA: Nemotron 3 Nano Omni (free)',
    providerName: 'NVIDIA',
    created: 1777420800,
    createdDate: '2026-04-28',
    daysAgo: 181,
    contextLength: 256000,
    contextLengthFormatted: '256K tokens',
    description: 'Nemotron 3 Nano Omni is a 30B-A3B open multimodal perception and reasoning model for text, images, video, and audio.',
    modality: 'text+image+audio+video->text',
    intelligenceTier: '옴니 멀티모달 추론',
    parametersSummary: '30B (활성 3B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Google: Gemma 4 26B A4B (free)',
    providerName: 'Google DeepMind',
    created: 1775260800,
    createdDate: '2026-04-03',
    daysAgo: 206,
    contextLength: 262144,
    contextLengthFormatted: '256K tokens',
    description: 'Gemma 4 26B A4B IT is Google DeepMind instruction-tuned MoE. 25.2B total, 3.8B active per token delivering near-31B dense quality.',
    modality: 'text+image+video->text',
    intelligenceTier: 'Google 경량 고성능 MoE',
    parametersSummary: '25.2B (활성 3.8B)',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google: Gemma 4 31B (free)',
    providerName: 'Google DeepMind',
    created: 1775174400,
    createdDate: '2026-04-02',
    daysAgo: 207,
    contextLength: 262144,
    contextLengthFormatted: '256K tokens',
    description: "Gemma 4 31B Instruct is Google DeepMind's dense multimodal model with 256K context, configurable thinking/reasoning mode.",
    modality: 'text+image+video->text',
    intelligenceTier: 'Google 31B Dense 종합 지능',
    parametersSummary: '30.7B Dense',
    supportedParameters: ['reasoning', 'temperature', 'tools'],
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'NVIDIA: Nemotron 3 Super (free)',
    providerName: 'NVIDIA',
    created: 1773273600,
    createdDate: '2026-03-11',
    daysAgo: 229,
    contextLength: 262144,
    contextLengthFormatted: '256K tokens',
    description: 'NVIDIA Nemotron 3 Super is a 120B hybrid MoE model (12B active), built on hybrid Mamba-Transformer architecture.',
    modality: 'text->text',
    intelligenceTier: '하이브리드 Mamba-MoE 120B',
    parametersSummary: '120B (활성 12B)',
    supportedParameters: ['reasoning', 'reasoning_effort', 'temperature', 'tools'],
  },
];

export async function fetchFreeModels(config: GatewayConfig): Promise<FreeModelMeta[]> {
  try {
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const url = `${baseUrl}/v1/models`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.gatewaySecret}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[API] Could not fetch models from gateway, using fallback:', err);
  }

  return FALLBACK_FREE_MODELS;
}

export async function checkGatewayHealth(config: GatewayConfig): Promise<boolean> {
  try {
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface StreamChatParams {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model: string;
  reasoningEffort: ReasoningEffortOption;
  config: GatewayConfig;
  signal?: AbortSignal;
  onDelta: (contentChunk: string, reasoningChunk: string) => void;
  onError: (errorMsg: string) => void;
  onFinish: () => void;
}

export async function streamChatCompletions({
  messages,
  model,
  reasoningEffort,
  config,
  signal,
  onDelta,
  onError,
  onFinish,
}: StreamChatParams): Promise<void> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const url = `${baseUrl}/v1/chat/completions`;

  const body = {
    model,
    messages,
    stream: true,
    reasoning_effort: reasoningEffort !== 'none' ? reasoningEffort : undefined,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.gatewaySecret}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `오류가 발생했어요 (HTTP ${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch {
        if (errText) errMsg = errText;
      }
      onError(errMsg);
      return;
    }

    if (!response.body) {
      onError('서버로부터 응답 스트림을 받지 못했어요.');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed === 'data: [DONE]') {
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const choice = parsed.choices?.[0];
            if (choice) {
              const delta = choice.delta || {};
              const content = delta.content || '';
              const reasoning = delta.reasoning || delta.reasoning_content || '';
              if (content || reasoning) {
                onDelta(content, reasoning);
              }
            }
          } catch {
            // JSON 파싱 실패 무시
          }
        }
      }
    }

    onFinish();
  } catch (error) {
    if (signal?.aborted) {
      onFinish();
      return;
    }
    const message = error instanceof Error ? error.message : '네트워크 연결이 원활하지 않아요.';
    onError(message);
  }
}
