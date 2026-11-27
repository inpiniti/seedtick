// ModelService.ts - OpenRouter 무료 모델 목록 및 메타데이터 서비스

import { env } from '../../config/env.ts';
import type { FreeModelMeta } from '../types.ts';

interface ModelPerfMetric {
  speedTokensPerSecond: number;
  latencyMs: number;
  dataPolicy?: FreeModelMeta['dataPolicy'];
}

interface OpenRouterLiveCatalog {
  perfByModel: Map<string, ModelPerfMetric>;
  extraFreeModels: FreeModelMeta[];
}

interface GetModelsOptions {
  forceRefresh?: boolean;
  includeAllOutputs?: boolean;
}

interface SelectModelOptions {
  outputModality: 'text' | 'image' | 'audio' | 'video';
  requiredInputs?: Array<'text' | 'image' | 'audio' | 'video'>;
  excludeIds?: string[];
  excludeProviderPrefixes?: string[];
  /** 입력은 text/tools만, 출력은 text만 허용한다 (동물 대화 등 텍스트 전용 용도). */
  textOnly?: boolean;
  /** 추론을 끄고 빠르게 응답하는 텍스트 모델을 우선 선택한다 (큐레이션/브리핑/동물 대화). */
  preferFastNonReasoning?: boolean;
}

// OpenRouter API 일시 장애 시 사용하는 기본 폴백 모델 목록.
// 제공사가 내린 모델은 404로 발견 즉시 런타임에서 제외된다 (markModelUnavailable).
const FALLBACK_FREE_MODELS: FreeModelMeta[] = [
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
    intelligenceIndex: 13.6,
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
    intelligenceIndex: null,
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
    intelligenceIndex: 5.5,
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
    intelligenceIndex: 12.9,
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
    intelligenceIndex: 12.5,
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

// OpenRouter의 /api/v1/models(텍스트 모델)에는 노출되지 않지만 무료로 쓸 수 있는 이미지 생성 모델.
// 이미지 생성 모델은 /api/v1/images 엔드포인트로 호출해야 하므로 별도로 관리한다.
const IMAGE_GENERATION_FREE_MODELS: FreeModelMeta[] = [
  {
    id: 'recraft/recraft-v4.1-flash-v2:free',
    name: 'Recraft: Recraft V4.1 Flash V2 (free)',
    providerName: 'Recraft',
    created: 1794608385,
    createdDate: '2026-11-13',
    daysAgo: 5,
    contextLength: 65536,
    contextLengthFormatted: '텍스트 → 이미지',
    description:
      'Recraft V4.1 Flash V2 is a fast text-to-image model from Recraft, updated from Recraft V4.1 Flash in the speed tier of the V4.1 family. Suited for rapid iteration, prototyping and high-volume generation with improved generation speed and text rendering inside images.',
    modality: 'text->image',
    inputModalities: ['text'],
    outputModalities: ['image'],
    isImageGenerationModel: true,
    intelligenceIndex: null,
    intelligenceTier: '무료 텍스트→이미지 생성 (V4.1 Flash V2)',
    parametersSummary: 'V4.1 Flash V2',
    supportedParameters: ['n', 'aspect_ratio'],
  },
];

// OpenCode Console 무료 채팅 모델 전체 (브릿지가 설정된 경우 노출).
// 스펙은 models.dev/api.json(opencode/opencode-go 프로바이더) 기준이다.
// 예전에는 전부 text->text로 하드코딩해 하이브리드 모델이 "텍스트 전용"으로
// 표시되고 비전 모델 셀렉터에서 제외되는 문제가 있었다.
const OPENCODE_DOCS_URL = 'https://opencode.ai/docs/models/';
const OPENCODE_FREE_MODEL_SEEDS: ReadonlyArray<{
  id: string;
  name: string;
  createdDate: string;
  contextLength: number;
  description: string;
  inputModalities: string[];
  supportsReasoning: boolean;
  supportsTools: boolean;
  supportsStructuredOutput?: boolean;
  supportedEfforts?: string[];
  reasoningToggle?: boolean;
}> = [
  {
    id: 'big-pickle',
    name: 'Big Pickle',
    createdDate: '2025-10-17',
    contextLength: 200000,
    description:
      'Reasoning model for deliberate analysis, multi-step problem solving, and tool use',
    inputModalities: ['text'],
    supportsReasoning: true,
    supportsTools: true,
    supportsStructuredOutput: true,
  },
  {
    id: 'mimo-v2.6-flash-free',
    name: 'MiMo-V2.6-Flash Free',
    createdDate: '2026-09-22',
    contextLength: 200000,
    description: 'MiMo Flash model for multimodal coding agents and long-context automation',
    inputModalities: ['text', 'image', 'audio', 'video'],
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: 'deepseek-v4.1-flash-free',
    name: 'DeepSeek V4.1 Flash Free',
    createdDate: '2026-10-17',
    contextLength: 200000,
    description:
      'October 17 update of DeepSeek V4.1 Flash with improved reasoning, coding, agentic tasks, and visual understanding',
    inputModalities: ['text', 'image'],
    supportsReasoning: true,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportedEfforts: ['low', 'high', 'max'],
    reasoningToggle: true,
  },
  {
    id: 'iceman-free',
    name: 'Iceman Free',
    createdDate: '2026-11-06',
    contextLength: 262144,
    description: 'Stealth model, free for a limited time',
    inputModalities: ['text'],
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: 'beam-free',
    name: 'Beam Free',
    createdDate: '2026-10-05',
    contextLength: 1048576,
    description:
      'Sparse mixture-of-experts reasoning model with 23B active parameters for coding and agentic workflows',
    inputModalities: ['text'],
    supportsReasoning: true,
    supportsTools: true,
    supportsStructuredOutput: true,
    supportedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
  {
    id: 'flint-40b-free',
    name: 'Flint 40B Free',
    createdDate: '2026-10-21',
    contextLength: 262144,
    description:
      'Open-weight mixture-of-experts model with about 2.5B active parameters for local coding agents',
    inputModalities: ['text'],
    supportsReasoning: true,
    supportsTools: true,
    supportedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
  {
    id: 'nemotron-3.5-super-vl-free',
    name: 'Nemotron 3.5 Super VL Free',
    createdDate: '2026-10-15',
    contextLength: 1048576,
    description:
      'NVIDIA vision-language reasoning model for text, image, and video understanding and agentic tool use',
    inputModalities: ['text', 'image'],
    supportsReasoning: true,
    supportsTools: true,
    supportedEfforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'],
  },
  {
    id: 'nemotron-3.5-lightning-free',
    name: 'Nemotron 3.5 Lightning Free',
    createdDate: '2026-08-11',
    contextLength: 262144,
    description: 'Fast NVIDIA Nemotron MoE for reliable agentic tasks across enterprise workloads',
    inputModalities: ['text'],
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: 'hy4-flash-free',
    name: 'Hy4 flash Free',
    createdDate: '2026-11-16',
    contextLength: 1048576,
    description:
      "Tencent's lower-cost Hy4 tier for everyday agent and productivity tasks, with image understanding and a 1M-token context window.",
    inputModalities: ['text', 'image'],
    supportsReasoning: true,
    supportsTools: true,
    supportedEfforts: ['none', 'high'],
  },
  {
    id: 'tidepool-alpha-free',
    name: 'Tidepool Alpha Free',
    createdDate: '2026-11-18',
    contextLength: 1048576,
    description: 'Stealth reasoning model, free for a limited time',
    inputModalities: ['text'],
    supportsReasoning: true,
    supportsTools: true,
    supportedEfforts: ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
  },
];

function buildOpenCodeFreeModels(now: number): FreeModelMeta[] {
  return OPENCODE_FREE_MODEL_SEEDS.map((seed) => {
    const created = Math.floor(new Date(`${seed.createdDate}T00:00:00Z`).getTime() / 1000);
    return {
      id: `opencode/${seed.id}`,
      name: `OpenCode: ${seed.name}`,
      providerName: 'OpenCode',
      created,
      createdDate: seed.createdDate,
      daysAgo: Math.max(0, Math.floor((now - created * 1000) / (24 * 60 * 60 * 1000))),
      contextLength: seed.contextLength,
      contextLengthFormatted:
        seed.contextLength >= 1000000
          ? `${Math.round(seed.contextLength / 1000000)}M tokens`
          : `${Math.round(seed.contextLength / 1000)}K tokens`,
      description: seed.description,
      modality: `${seed.inputModalities.join('+')}->text`,
      inputModalities: seed.inputModalities,
      outputModalities: ['text'],
      dataPolicy: {
        // OpenCode는 공개 정책 메타가 일관되게 제공되지 않아 안전 우선으로 학습 사용 가능(true)로 간주한다.
        training: true,
      },
      supportsReasoning: seed.supportsReasoning,
      supportsTools: seed.supportsTools,
      supportsStructuredOutput: seed.supportsStructuredOutput,
      supportedEfforts: seed.supportedEfforts,
      reasoningToggle: seed.reasoningToggle,
      docsUrl: OPENCODE_DOCS_URL,
      intelligenceIndex: null,
      codingIndex: null,
      agenticIndex: null,
      intelligenceTier: 'OpenCode 무료',
      parametersSummary: seed.name,
      supportedParameters: [],
    };
  });
}

export class ModelService {
  private cache: FreeModelMeta[] | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL_MS = 2 * 60 * 1000; // 2분 캐시
  /** OpenRouter가 내린 모델 — 404 확인 시 캐시/폴백 목록에서 즉시 제거한다. */
  private readonly unavailableModelIds = new Set<string>();

  /** 404가 난 모델을 다시 선택하지 않도록 카탈로그에서 영구히(런타임 중) 제외한다. */
  markModelUnavailable(modelId: string): void {
    const id = modelId.trim();
    if (!id) return;
    this.unavailableModelIds.add(id);
    if (this.cache) this.cache = this.cache.filter((model) => model.id !== id);
    // 다음 요청에서 최신 목록을 받아 스테일 폴백이 되살아나지 않게 한다.
    this.lastFetchTime = 0;
  }

  isModelUnavailable(modelId: string): boolean {
    return this.unavailableModelIds.has(modelId.trim());
  }

  async getFreeModels(options?: GetModelsOptions): Promise<FreeModelMeta[]> {
    const now = Date.now();
    if (!options?.forceRefresh && this.cache && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.filterForConsumer(this.cache, options?.includeAllOutputs === true);
    }

    try {
      const [response, liveCatalog] = await Promise.all([
        fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'HTTP-Referer': 'https://reportist.kr',
            'X-Title': 'Reportist',
          },
        }),
        this.fetchOpenRouterLiveCatalog(),
      ]);
      const livePerf = liveCatalog.perfByModel;

      if (!response.ok) {
        console.warn(`[ModelService] Failed to fetch OpenRouter models: HTTP ${response.status}`);
        const fallback = this.withFrontendExtraModels(
          this.withImageModels(this.cache ?? FALLBACK_FREE_MODELS),
          liveCatalog.extraFreeModels
        );
        return this.filterForConsumer(fallback, options?.includeAllOutputs === true);
      }

      const json = (await response.json()) as { data?: unknown[] };
      if (!Array.isArray(json?.data)) {
        const fallback = this.withFrontendExtraModels(
          this.withImageModels(this.cache ?? FALLBACK_FREE_MODELS),
          liveCatalog.extraFreeModels
        );
        return this.filterForConsumer(fallback, options?.includeAllOutputs === true);
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

        if (!isFree) continue;

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
        const supportsTools =
          supportedParameters.includes('tools') || supportedParameters.includes('tool_choice');
        const supportsStructuredOutput =
          supportedParameters.includes('structured_outputs') ||
          supportedParameters.includes('response_format');

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
        const supportsReasoning = Boolean(
          reasoningMandatory ||
            (Array.isArray(supportedEfforts) && supportedEfforts.length > 0) ||
            supportedParameters.includes('reasoning')
        );

        // 지능 티어 및 파라미터 요약 추출
        const { intelligenceTier, parametersSummary, providerName } = this.deriveModelIntelligence(
          id,
          name,
          description,
          intelligenceIndex
        );

        const live = livePerf.get(id.replace(/:free$/i, '')) ?? livePerf.get(id);

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
          outputModalities: outputModalities.length > 0 ? outputModalities : ['text'],
          intelligenceIndex,
          codingIndex,
          agenticIndex,
          supportedEfforts,
          defaultEffort,
          reasoningMandatory,
          supportsReasoning,
          supportsTools,
          supportsStructuredOutput,
          dataPolicy: live?.dataPolicy,
          speedTokensPerSecond: live?.speedTokensPerSecond ?? null,
          latencyMs: live?.latencyMs ?? null,
          intelligenceTier,
          parametersSummary,
          supportedParameters,
        });
      }

      if (freeModels.length > 0) {
        // 최신 생성순 정렬
        freeModels.sort((a, b) => b.created - a.created);
        this.cache = this.withFrontendExtraModels(
          this.withImageModels(freeModels),
          liveCatalog.extraFreeModels
        );
        this.lastFetchTime = now;
        return this.filterForConsumer(this.cache, options?.includeAllOutputs === true);
      }

      const fallback = this.withFrontendExtraModels(
        this.withImageModels(this.cache ?? FALLBACK_FREE_MODELS),
        liveCatalog.extraFreeModels
      );
      return this.filterForConsumer(fallback, options?.includeAllOutputs === true);
    } catch (err) {
      console.error('[ModelService] Error fetching openrouter models:', err);
      const fallback = this.withImageModels(this.cache ?? FALLBACK_FREE_MODELS);
      return this.filterForConsumer(fallback, options?.includeAllOutputs === true);
    }
  }

  async getCatalogStatus(
    forceRefresh = false,
    includeAllOutputs = false
  ): Promise<{
    total: number;
    providers: Record<string, number>;
    outputModalities: Record<string, number>;
    trainingPolicy: { nonTraining: number; unknown: number; training: number };
    data: FreeModelMeta[];
  }> {
    const models = await this.getFreeModels({ forceRefresh, includeAllOutputs });
    const providers: Record<string, number> = {};
    const outputModalities: Record<string, number> = {};
    const trainingPolicy = { nonTraining: 0, unknown: 0, training: 0 };

    for (const model of models) {
      const provider = this.getProviderTag(model.id);
      providers[provider] = (providers[provider] ?? 0) + 1;

      const outs = model.outputModalities?.length ? model.outputModalities : ['text'];
      for (const out of outs) {
        outputModalities[out] = (outputModalities[out] ?? 0) + 1;
      }

      const risk = this.trainingRiskRank(model);
      if (risk === 0) trainingPolicy.nonTraining++;
      else if (risk === 1) trainingPolicy.unknown++;
      else trainingPolicy.training++;
    }

    return {
      total: models.length,
      providers,
      outputModalities,
      trainingPolicy,
      data: models,
    };
  }

  private filterForConsumer(models: FreeModelMeta[], includeAllOutputs: boolean): FreeModelMeta[] {
    const available = models.filter((model) => !this.unavailableModelIds.has(model.id));
    if (includeAllOutputs) return available;
    return available.filter((model) => {
      if (model.isImageGenerationModel) return true;
      const outputs = model.outputModalities?.length ? model.outputModalities : ['text'];
      return outputs.includes('text');
    });
  }

  /** 모델 카탈로그에서 단일 모델 메타를 찾는다. 요청 파라미터 호환성 판단에 쓴다. */
  async findModelById(modelId: string): Promise<FreeModelMeta | null> {
    const id = modelId.trim();
    if (!id) return null;
    const all = await this.getFreeModels();
    return all.find((model) => model.id === id) ?? null;
  }

  async selectBestModel(options: SelectModelOptions): Promise<FreeModelMeta | null> {
    const all = await this.getFreeModels();
    const filtered = all
      .filter((model) => !this.isGuardrailModel(model))
      .filter((model) => {
        const outputs = model.outputModalities?.length ? model.outputModalities : ['text'];
        return outputs.includes(options.outputModality);
      })
      .filter((model) => {
        if (!options.requiredInputs || options.requiredInputs.length === 0) return true;
        const inputs = model.inputModalities?.length ? model.inputModalities : ['text'];
        return options.requiredInputs.every((required) => inputs.includes(required));
      })
      .filter((model) => {
        if (!options.textOnly) return true;
        const inputs = (model.inputModalities?.length ? model.inputModalities : ['text']).map((m) =>
          m.trim().toLowerCase()
        );
        const outputs = (model.outputModalities?.length ? model.outputModalities : ['text']).map(
          (m) => m.trim().toLowerCase()
        );
        return (
          model.isImageGenerationModel !== true &&
          inputs.includes('text') &&
          inputs.every((m) => m === 'text' || m === 'tools') &&
          outputs.includes('text') &&
          outputs.every((m) => m === 'text')
        );
      })
      .filter((model) => {
        if (!options.excludeProviderPrefixes || options.excludeProviderPrefixes.length === 0) {
          return true;
        }
        return !options.excludeProviderPrefixes.some((prefix) => model.id.startsWith(prefix));
      })
      .filter((model) => !options.excludeIds?.includes(model.id))
      .sort((a, b) => this.compareForAutoSelection(a, b, options.preferFastNonReasoning === true));

    return filtered[0] ?? null;
  }

  /** 이미지 생성 모델을 모델 목록에 합친다 (중복 제거 + 최신순 정렬) */
  private withImageModels(models: FreeModelMeta[]): FreeModelMeta[] {
    const byId = new Map<string, FreeModelMeta>();
    for (const model of models) byId.set(model.id, model);
    for (const model of IMAGE_GENERATION_FREE_MODELS) {
      if (!byId.has(model.id)) byId.set(model.id, model);
    }
    if (env.opencodeKeys.length > 0) {
      for (const model of buildOpenCodeFreeModels(Date.now())) {
        if (!byId.has(model.id)) byId.set(model.id, model);
      }
    }
    return Array.from(byId.values()).sort((a, b) => b.created - a.created);
  }

  private withFrontendExtraModels(
    models: FreeModelMeta[],
    frontendExtras: FreeModelMeta[]
  ): FreeModelMeta[] {
    if (frontendExtras.length === 0) return models;
    const byId = new Map<string, FreeModelMeta>();
    for (const model of models) byId.set(model.id, model);
    for (const model of frontendExtras) {
      if (!byId.has(model.id)) byId.set(model.id, model);
    }
    return Array.from(byId.values()).sort((a, b) => b.created - a.created);
  }

  private trainingRiskRank(model: FreeModelMeta): number {
    if (model.dataPolicy?.training === false) return 0;
    if (model.dataPolicy?.training === true) return 2;
    return 1;
  }

  private canDisableReasoning(model: FreeModelMeta): boolean {
    if (model.reasoningMandatory === true) return false;
    if (model.supportedEfforts?.length && !model.supportedEfforts.includes('none')) return false;
    return true;
  }

  private compareForAutoSelection(
    a: FreeModelMeta,
    b: FreeModelMeta,
    preferFastNonReasoning = false
  ): number {
    if (preferFastNonReasoning) {
      const noReasonA = this.canDisableReasoning(a) ? 0 : 1;
      const noReasonB = this.canDisableReasoning(b) ? 0 : 1;
      if (noReasonA !== noReasonB) return noReasonA - noReasonB;

      const speedA = a.speedTokensPerSecond ?? 0;
      const speedB = b.speedTokensPerSecond ?? 0;
      if (speedA !== speedB) return speedB - speedA;

      const latA = a.latencyMs && a.latencyMs > 0 ? a.latencyMs : Number.MAX_SAFE_INTEGER;
      const latB = b.latencyMs && b.latencyMs > 0 ? b.latencyMs : Number.MAX_SAFE_INTEGER;
      if (latA !== latB) return latA - latB;
    }

    const riskA = this.trainingRiskRank(a);
    const riskB = this.trainingRiskRank(b);
    if (riskA !== riskB) return riskA - riskB;

    const daysA = a.daysAgo ?? 9999;
    const daysB = b.daysAgo ?? 9999;
    if (daysA !== daysB) return daysA - daysB;

    const intelA = a.intelligenceIndex ?? -1;
    const intelB = b.intelligenceIndex ?? -1;
    if (intelA !== intelB) return intelB - intelA;

    const codingA = a.codingIndex ?? -1;
    const codingB = b.codingIndex ?? -1;
    if (codingA !== codingB) return codingB - codingA;

    const agenticA = a.agenticIndex ?? -1;
    const agenticB = b.agenticIndex ?? -1;
    if (agenticA !== agenticB) return agenticB - agenticA;

    const contextA = a.contextLength ?? 0;
    const contextB = b.contextLength ?? 0;
    if (contextA !== contextB) return contextB - contextA;

    const speedA = a.speedTokensPerSecond ?? 0;
    const speedB = b.speedTokensPerSecond ?? 0;
    if (speedA !== speedB) return speedB - speedA;

    return (a.name ?? '').localeCompare(b.name ?? '');
  }

  private isGuardrailModel(model: FreeModelMeta): boolean {
    const haystack = `${model.id} ${model.name} ${model.intelligenceTier ?? ''}`.toLowerCase();
    return (
      haystack.includes('content-safety') ||
      haystack.includes('content safety') ||
      haystack.includes('guardrail') ||
      haystack.includes('안전성')
    );
  }

  private getProviderTag(modelId: string): string {
    if (modelId.startsWith('opencode/')) return 'opencode';
    const [provider] = modelId.split('/');
    return provider || 'unknown';
  }

  private async fetchOpenRouterLiveCatalog(): Promise<OpenRouterLiveCatalog> {
    const perfByModel = new Map<string, ModelPerfMetric>();
    const extraFreeModels: FreeModelMeta[] = [];
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://openrouter.ai/api/frontend/v1/models/find?max_price=0', {
        headers: {
          'HTTP-Referer': 'https://reportist.kr',
          'X-Title': 'Reportist',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return { perfByModel, extraFreeModels };

      const json = (await res.json()) as {
        data?: {
          endpoint_perf?: Record<string, { p50_throughput?: number; p50_latency?: number }>;
          models?: Array<{
            slug?: string;
            name?: string;
            description?: string;
            created_at?: string;
            updated_at?: string;
            input_modalities?: string[];
            output_modalities?: string[];
            context_length?: number;
            endpoint?: {
              id?: string;
              model_variant_slug?: string;
              provider_display_name?: string;
              provider_info?: { dataPolicy?: Record<string, unknown> };
              data_policy?: Record<string, unknown>;
              supported_parameters?: string[];
            };
            data_policy?: Record<string, unknown>;
            supports_reasoning?: boolean;
          }>;
        };
      };
      const perfMap = json.data?.endpoint_perf ?? {};
      const models = Array.isArray(json.data?.models) ? json.data.models : [];

      for (const model of models) {
        const endpointId = model.endpoint?.id as string | undefined;
        const perf = endpointId ? perfMap[endpointId] : undefined;
        const rawDataPolicy =
          model.endpoint?.provider_info?.dataPolicy ??
          model.endpoint?.data_policy ??
          model.data_policy;

        const dataPolicy = rawDataPolicy
          ? {
              training:
                typeof rawDataPolicy.training === 'boolean' ? rawDataPolicy.training : undefined,
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
                  : ((rawDataPolicy.prompt_retention_days as number | null | undefined) ?? null),
              safetyRetention:
                typeof rawDataPolicy.safetyRetention === 'boolean'
                  ? rawDataPolicy.safetyRetention
                  : undefined,
            }
          : undefined;

        const speed =
          perf?.p50_throughput != null && Number.isFinite(perf.p50_throughput)
            ? Math.round(perf.p50_throughput)
            : 0;
        const latency =
          perf?.p50_latency != null && Number.isFinite(perf.p50_latency)
            ? Math.round(perf.p50_latency)
            : 0;

        if (model.slug && (speed || latency || dataPolicy)) {
          const entry: ModelPerfMetric = {
            speedTokensPerSecond: speed,
            latencyMs: latency,
            dataPolicy,
          };
          perfByModel.set(model.slug, entry);
          perfByModel.set(`${model.slug}:free`, entry);
          perfByModel.set(model.slug.replace(/:free$/i, ''), entry);
        }

        const outputModalities =
          Array.isArray(model.output_modalities) && model.output_modalities.length > 0
            ? model.output_modalities
            : ['text'];
        const outputsText = outputModalities.includes('text');
        if (outputsText) continue;

        const modelId = model.endpoint?.model_variant_slug || model.slug;
        if (!modelId || !modelId.endsWith(':free')) continue;

        const inputModalities =
          Array.isArray(model.input_modalities) && model.input_modalities.length > 0
            ? model.input_modalities
            : ['text'];
        const modality = `${inputModalities.join('+')}->${outputModalities.join('+')}`;
        const createdAt = model.created_at || model.updated_at;
        const createdDateObj = createdAt ? new Date(createdAt) : new Date();
        const createdMs = Number.isFinite(createdDateObj.getTime())
          ? createdDateObj.getTime()
          : Date.now();
        const createdSec = Math.floor(createdMs / 1000);
        const daysAgo = Math.max(0, Math.floor((Date.now() - createdMs) / (24 * 60 * 60 * 1000)));
        const createdDate = new Date(createdMs).toISOString().split('T')[0];
        const contextLength = typeof model.context_length === 'number' ? model.context_length : 0;
        const contextLengthFormatted = contextLength > 0 ? `${contextLength} tokens` : '-';
        const supportedParameters = model.endpoint?.supported_parameters ?? [];
        const providerName = model.endpoint?.provider_display_name ?? 'OpenRouter';
        const name = model.name || modelId;
        const description = model.description || '';
        const { intelligenceTier, parametersSummary } = this.deriveModelIntelligence(
          modelId,
          name,
          description,
          null
        );

        extraFreeModels.push({
          id: modelId,
          name,
          providerName,
          created: createdSec,
          createdDate,
          daysAgo,
          contextLength,
          contextLengthFormatted,
          description,
          modality,
          inputModalities,
          outputModalities,
          supportsReasoning: Boolean(model.supports_reasoning),
          supportsTools: supportedParameters.includes('tools'),
          supportsStructuredOutput:
            supportedParameters.includes('structured_outputs') ||
            supportedParameters.includes('response_format'),
          dataPolicy,
          speedTokensPerSecond: speed || null,
          latencyMs: latency || null,
          intelligenceIndex: null,
          codingIndex: null,
          agenticIndex: null,
          intelligenceTier,
          parametersSummary,
          supportedParameters,
        });
      }
    } catch {
      // 실시간 메트릭 실패 시 기본 데이터만 사용
    }
    return { perfByModel, extraFreeModels };
  }

  private deriveModelIntelligence(
    id: string,
    _name: string,
    desc: string,
    _intelIndex?: number | null
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
