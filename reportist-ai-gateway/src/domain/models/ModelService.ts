// ModelService.ts - OpenRouter 무료 텍스트 모델 목록 및 메타데이터 서비스

import type { FreeModelMeta } from '../types.ts';

// 17개 기본 모델 (OpenRouter API 일시 장애 시 완벽한 폴백 보장)
const FALLBACK_FREE_MODELS: FreeModelMeta[] = [
  {
    id: 'recursive/flint-v1.0:free',
    name: 'Recursive: Flint (free)',
    providerName: 'Recursive',
    created: 1792627200,
    createdDate: '2026-10-21',
    daysAgo: 5,
    contextLength: 262144,
    contextLengthFormatted: '256K tokens',
    description:
      "Flint is an open-weight mixture-of-experts model from Recursive, with about 2.5B active parameters out of 40B total, built by Recursive's autoresearch system Eureka Machine for coding agents.",
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: null,
    reasoningMandatory: true,
    intelligenceTier: '코딩 에이전트 특화',
    parametersSummary: '40B (활성 2.5B)',
    supportedParameters: ['reasoning', 'temperature', 'tools', 'response_format'],
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
    description:
      'Xing4.0-29B-A4B is an open-weight mixture-of-experts language model from China Telecom AI team (TeleAI). It has 29B total parameters with 4B active per token.',
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: null,
    intelligenceTier: '다목적 고성능 MoE',
    parametersSummary: '29B (활성 4B)',
    supportedParameters: ['reasoning', 'temperature', 'tools', 'structured_outputs'],
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
    description:
      'NVIDIA Nemotron 3.5 Super VL is an open multimodal MoE model with 12B active parameters out of 120B total. Takes text, images, docs, GUI screenshots, and video.',
    modality: 'text+image+video->text',
    inputModalities: ['text', 'image', 'video'],
    intelligenceIndex: 26.5,
    intelligenceTier: '플래그십 멀티모달 & 1M 윈도우',
    parametersSummary: '120B (활성 12B)',
    supportedParameters: ['reasoning', 'temperature', 'tools', 'structured_outputs'],
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
    description:
      'Dots3-Note Preview is an open-weight MoE model with 16B active parameters out of 280B total. Suited for long-form reasoning and note summarization.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceIndex: null,
    intelligenceTier: '초대형 280B 추론 MoE',
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
    description:
      'LFM2.5-2.6B is a compact reasoning model from Liquid AI. Suited for agent workflows, data extraction, and fast RAG.',
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: 8.4,
    codingIndex: 7.7,
    reasoningMandatory: true,
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
    description:
      'NVIDIA Nemotron 3.5 Lightning is an open MoE model with 3B active parameters out of 30B total, designed for high-throughput agentic workloads.',
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: 12.9,
    codingIndex: 26.8,
    agenticIndex: 3.5,
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
    description:
      'Inkling Small is an open multimodal MoE model with 12B active parameters out of 276B total. High-efficiency reasoning and tool usage.',
    modality: 'text+image+audio->text',
    inputModalities: ['text', 'image', 'audio'],
    intelligenceIndex: 25.7,
    codingIndex: 52.9,
    agenticIndex: 23.5,
    supportedEfforts: ['max', 'high', 'medium', 'low', 'minimal', 'none'],
    defaultEffort: 'high',
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
    description:
      'Laguna S 2.1 is a top-tier coding agent model with 118B total parameters and 8B active parameters, scoring 70.2% on Terminal-Bench.',
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: null,
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
    description:
      'Inkling is a mammoth 975B MoE model (41B active) designed for general-purpose frontier reasoning, coding, and tool-use.',
    modality: 'text+image+audio->text',
    inputModalities: ['text', 'image', 'audio'],
    intelligenceIndex: 25.0,
    codingIndex: 52.1,
    agenticIndex: 22.5,
    supportedEfforts: ['max', 'high', 'medium', 'low', 'minimal', 'none'],
    defaultEffort: 'high',
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
    description:
      'Laguna XS 2.1 is an efficient 33B-A3B coding model optimized for fast interactive software engineering.',
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: null,
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
    description:
      "North Mini Code is Cohere's first agentic coding model. Sparse MoE with 30B total and 3B active parameters.",
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: 9.9,
    codingIndex: 36.5,
    agenticIndex: 1.1,
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
    description:
      'NVIDIA Nemotron 3.5 Content Safety is a compact 4B-parameter multimodal guardrail model fine-tuned from Gemma-3-4B.',
    modality: 'text+image->text',
    inputModalities: ['text', 'image'],
    intelligenceIndex: null,
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
    description:
      'NVIDIA Nemotron 3 Ultra is an open frontier reasoning model with 55B active out of 550B total parameters (Transformer-Mamba MoE).',
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: 22.9,
    codingIndex: 49.3,
    agenticIndex: 20.1,
    supportedEfforts: ['high', 'medium', 'none'],
    defaultEffort: 'high',
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
    description:
      'Nemotron 3 Nano Omni is a 30B-A3B open multimodal perception and reasoning model for text, images, video, and audio.',
    modality: 'text+image+audio+video->text',
    inputModalities: ['text', 'image', 'audio', 'video'],
    intelligenceIndex: 10.3,
    codingIndex: 13.8,
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
    description:
      'Gemma 4 26B A4B IT is Google DeepMind instruction-tuned MoE. 25.2B total, 3.8B active per token delivering near-31B dense quality.',
    modality: 'text+image+video->text',
    inputModalities: ['text', 'image', 'video'],
    intelligenceIndex: 16.7,
    codingIndex: 39.3,
    agenticIndex: 2.9,
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
    description:
      "Gemma 4 31B Instruct is Google DeepMind's dense multimodal model with 256K context, configurable thinking/reasoning mode.",
    modality: 'text+image+video->text',
    inputModalities: ['text', 'image', 'video'],
    intelligenceIndex: 14.7,
    codingIndex: 43.4,
    agenticIndex: 4.2,
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
    description:
      'NVIDIA Nemotron 3 Super is a 120B hybrid MoE model (12B active), built on hybrid Mamba-Transformer architecture.',
    modality: 'text->text',
    inputModalities: ['text'],
    intelligenceIndex: 12.8,
    codingIndex: 37.7,
    agenticIndex: 1.7,
    supportedEfforts: ['medium', 'low', 'none'],
    defaultEffort: 'medium',
    intelligenceTier: '하이브리드 Mamba-MoE 120B',
    parametersSummary: '120B (활성 12B)',
    supportedParameters: ['reasoning', 'reasoning_effort', 'temperature', 'tools'],
  },
];

export class ModelService {
  private cache: FreeModelMeta[] | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1시간 캐시

  async getFreeModels(): Promise<FreeModelMeta[]> {
    const now = Date.now();
    if (this.cache && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cache;
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'HTTP-Referer': 'https://reportist.kr',
          'X-Title': 'Reportist',
        },
      });

      if (!response.ok) {
        console.warn(`[ModelService] Failed to fetch OpenRouter models: HTTP ${response.status}`);
        return this.cache ?? FALLBACK_FREE_MODELS;
      }

      const json = (await response.json()) as { data?: unknown[] };
      if (!Array.isArray(json?.data)) {
        return this.cache ?? FALLBACK_FREE_MODELS;
      }

      const rawModels = json.data as Array<Record<string, unknown>>;
      const freeModels: FreeModelMeta[] = [];

      for (const m of rawModels) {
        const id = typeof m.id === 'string' ? m.id : '';
        const isFree = id.endsWith(':free');
        const arch = (m.architecture as Record<string, unknown>) ?? {};
        const outputModalities = Array.isArray(arch.output_modalities)
          ? (arch.output_modalities as string[])
          : [];
        const outputsText = outputModalities.includes('text');

        if (!isFree || !outputsText) continue;

        const createdSec = typeof m.created === 'number' ? m.created : Math.floor(now / 1000);
        const createdDateObj = new Date(createdSec * 1000);
        const createdDate = createdDateObj.toISOString().split('T')[0];
        const daysAgo = Math.max(0, Math.floor((now - createdSec * 1000) / (24 * 60 * 60 * 1000)));

        const contextLen = typeof m.context_length === 'number' ? m.context_length : 0;
        let contextLengthFormatted = `${contextLen} tokens`;
        if (contextLen >= 1_000_000) {
          contextLengthFormatted = `${Math.round(contextLen / 1_000_000)}M tokens`;
        } else if (contextLen >= 1_000) {
          contextLengthFormatted = `${Math.round(contextLen / 1_000)}K tokens`;
        }

        const name = typeof m.name === 'string' ? m.name : id;
        const description = typeof m.description === 'string' ? m.description : '';
        const modality = typeof arch.modality === 'string' ? arch.modality : 'text->text';
        const rawInputModalities = Array.isArray(arch.input_modalities)
          ? (arch.input_modalities as string[])
          : modality.includes('->')
            ? modality.split('->')[0].split('+')
            : ['text'];
        const inputModalities = [...new Set(rawInputModalities)];
        const supportedParameters = Array.isArray(m.supported_parameters)
          ? (m.supported_parameters as string[])
          : [];

        const benchmarks = (m.benchmarks as Record<string, unknown>) ?? {};
        const aa = (benchmarks.artificial_analysis as Record<string, unknown>) ?? {};
        const intelligenceIndex =
          typeof aa.intelligence_index === 'number' ? aa.intelligence_index : null;
        const codingIndex = typeof aa.coding_index === 'number' ? aa.coding_index : null;
        const agenticIndex = typeof aa.agentic_index === 'number' ? aa.agentic_index : null;

        const reasoningObj = (m.reasoning as Record<string, unknown>) ?? {};
        const supportedEfforts = Array.isArray(reasoningObj.supported_efforts)
          ? (reasoningObj.supported_efforts as string[])
          : undefined;
        const defaultEffort =
          typeof reasoningObj.default_effort === 'string' ? reasoningObj.default_effort : null;
        const reasoningMandatory = Boolean(reasoningObj.mandatory);

        // 지능 티어 및 파라미터 요약 추출
        const { intelligenceTier, parametersSummary, providerName } = this.deriveModelIntelligence(
          id,
          name,
          description,
          intelligenceIndex
        );

        freeModels.push({
          id,
          name,
          providerName,
          created: createdSec,
          createdDate,
          daysAgo,
          contextLength: contextLen,
          contextLengthFormatted,
          description,
          modality,
          inputModalities,
          intelligenceIndex,
          codingIndex,
          agenticIndex,
          supportedEfforts,
          defaultEffort,
          reasoningMandatory,
          intelligenceTier,
          parametersSummary,
          supportedParameters,
        });
      }

      if (freeModels.length > 0) {
        // 최신 생성순 정렬
        freeModels.sort((a, b) => b.created - a.created);
        this.cache = freeModels;
        this.lastFetchTime = now;
        return freeModels;
      }

      return this.cache ?? FALLBACK_FREE_MODELS;
    } catch (err) {
      console.error('[ModelService] Error fetching openrouter models:', err);
      return this.cache ?? FALLBACK_FREE_MODELS;
    }
  }

  private deriveModelIntelligence(
    id: string,
    name: string,
    desc: string,
    intelIndex?: number | null
  ): { intelligenceTier: string; parametersSummary: string; providerName: string } {
    const lowerDesc = desc.toLowerCase();
    const [providerPrefix] = id.split('/');

    let providerName = providerPrefix;
    if (providerPrefix === 'nvidia') providerName = 'NVIDIA';
    else if (providerPrefix === 'google') providerName = 'Google DeepMind';
    else if (providerPrefix === 'cohere') providerName = 'Cohere';
    else if (providerPrefix === 'liquid') providerName = 'Liquid AI';
    else if (providerPrefix === 'poolside') providerName = 'Poolside';
    else if (providerPrefix === 'thinkingmachines') providerName = 'Thinking Machines Lab';
    else if (providerPrefix === 'xingchen-agi') providerName = 'XingChen (TeleAI)';
    else if (providerPrefix === 'recursive') providerName = 'Recursive';
    else if (providerPrefix === 'dots-studio') providerName = 'Dots Studio';

    let parametersSummary = 'N/A';
    // 파라미터 감지 (예: 120B, 550B, 40B out of 2.5B, etc.)
    const paramMatch = desc.match(/(\d+(?:\.\d+)?B)(?:-A(\d+(?:\.\d+)?B))?/i);
    const activeMatch = desc.match(
      /(\d+(?:\.\d+)?B)\s+active(?:\s+parameters)?\s+out\s+of\s+(\d+(?:\.\d+)?B)/i
    );

    if (activeMatch) {
      parametersSummary = `${activeMatch[2]} (활성 ${activeMatch[1]})`;
    } else if (paramMatch) {
      if (paramMatch[2]) {
        parametersSummary = `${paramMatch[1]} (활성 ${paramMatch[2]})`;
      } else {
        parametersSummary = paramMatch[1];
      }
    }

    let intelligenceTier = '범용 언어 모델';
    if (lowerDesc.includes('coding agent') || lowerDesc.includes('coding')) {
      intelligenceTier = '코딩 에이전트 특화';
    } else if (
      lowerDesc.includes('multimodal') ||
      lowerDesc.includes('image') ||
      lowerDesc.includes('video')
    ) {
      intelligenceTier = '멀티모달 시각 추론';
    } else if (lowerDesc.includes('reasoning') || lowerDesc.includes('thinking')) {
      intelligenceTier = '심층 논리 추론';
    } else if (lowerDesc.includes('compact') || lowerDesc.includes('lightweight')) {
      intelligenceTier = '초경량 고속';
    }

    // 유명 모델 특별 레이블링
    if (id.includes('nemotron-3-ultra')) {
      intelligenceTier = '초대형 550B 프론티어 추론';
    } else if (id.includes('nemotron-3.5-super-vl')) {
      intelligenceTier = '플래그십 120B 멀티모달 & 1M 윈도우';
    } else if (id.includes('inkling') && !id.includes('small')) {
      intelligenceTier = '거대 975B MoE 플래그십';
    } else if (id.includes('laguna-s')) {
      intelligenceTier = '최상위 코딩 에이전트 118B';
    } else if (id.includes('flint')) {
      intelligenceTier = '에이전트 특화 MoE (40B/2.5B)';
    }

    return { intelligenceTier, parametersSummary, providerName };
  }
}

export const modelService = new ModelService();
