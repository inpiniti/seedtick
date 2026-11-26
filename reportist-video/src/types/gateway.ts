export interface ModelDataPolicy {
  /** 모델 학습(Training)에 사용자 입출력 데이터가 사용되는지 여부 */
  training?: boolean;
  /** OpenRouter 자체 학습에 데이터가 사용되는지 여부 */
  trainingOpenRouter?: boolean;
  /** 프롬프트/응답 데이터를 서버에 보관(저장)하는지 여부 */
  retainsPrompts?: boolean;
  /** 데이터 보관 일수 */
  retentionDays?: number | null;
  /** 학대 방지 등 안전 목적의 임시 보관 여부 */
  safetyRetention?: boolean;
}

export interface FreeModelMeta {
  id: string;
  name: string;
  providerName?: string;
  created?: number;
  createdDate?: string;
  daysAgo?: number;
  contextLength?: number;
  contextLengthFormatted?: string;
  description?: string;
  modality?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  /** 텍스트 프롬프트로 이미지를 생성하는 모델 여부 */
  isImageGenerationModel?: boolean;
  intelligenceIndex?: number | null;
  codingIndex?: number | null;
  agenticIndex?: number | null;
  /** Artificial Analysis 기준 초당 출력 토큰 수 (tok/s) */
  speedTokensPerSecond?: number | null;
  /** 첫 토큰까지 걸리는 시간 (TTFT, ms) */
  latencyMs?: number | null;
  /** 활성 파라미터 기반 추정치 여부 */
  speedIsEstimate?: boolean;
  supportedEfforts?: string[];
  defaultEffort?: string | null;
  reasoningMandatory?: boolean;
  supportsReasoning?: boolean;
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  reasoningToggle?: boolean;
  docsUrl?: string;
  intelligenceTier?: string;
  parametersSummary?: string;
  supportedParameters?: string[];
  /** OpenRouter 제공사 데이터 정책 (학습 여부, 보관 기간 등) */
  dataPolicy?: ModelDataPolicy;
}

export function getModelInputModalities(model?: FreeModelMeta | null): string[] {
  if (!model) return ['text'];
  if (Array.isArray(model.inputModalities) && model.inputModalities.length > 0) {
    return model.inputModalities;
  }
  if (model.modality && model.modality.includes('->')) {
    const inputs = model.modality
      .split('->')[0]
      .split('+')
      .map((s) => s.trim());
    return inputs.length > 0 ? inputs : ['text'];
  }
  return ['text'];
}

/** 출력 모달리티. 메타데이터가 없으면 modality 문자열의 '->' 뒤를 사용한다. */
export function getModelOutputModalities(model?: FreeModelMeta | null): string[] {
  if (!model) return ['text'];
  if (Array.isArray(model.outputModalities) && model.outputModalities.length > 0) {
    return model.outputModalities;
  }
  if (model.modality && model.modality.includes('->')) {
    const outputs = model.modality
      .split('->')[1]
      .split('+')
      .map((s) => s.trim())
      .filter(Boolean);
    return outputs.length > 0 ? outputs : ['text'];
  }
  return ['text'];
}

/**
 * 텍스트 전용 대화(동물 수다)에 쓸 수 있는 모델인지 확인한다.
 * 입력은 text/tools만, 출력은 text만 허용하고 이미지·오디오·비디오 입출력 모델은 제외한다.
 */
export function isTextOnlyChatModel(model?: FreeModelMeta | null): boolean {
  if (!model || typeof model.id !== 'string' || !model.id.trim()) return false;
  if (model.isImageGenerationModel === true) return false;

  const inputs = getModelInputModalities(model).map((m) => m.trim().toLowerCase());
  const outputs = getModelOutputModalities(model).map((m) => m.trim().toLowerCase());

  if (!inputs.includes('text') || !outputs.includes('text')) return false;
  if (inputs.some((m) => m !== 'text' && m !== 'tools')) return false;
  if (outputs.some((m) => m !== 'text')) return false;
  return true;
}

export type ReasoningEffortOption = 'high' | 'medium' | 'low' | 'minimal' | 'none' | 'max';

export interface GatewayConfig {
  baseUrl: string;
  gatewaySecret: string;
}

export type UserAiProvider =
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'grok'
  | 'qwen'
  | 'glm'
  | 'kimi'
  | 'minimax'
  | 'muse'
  | 'custom';

export interface UserApiKeyConfig {
  provider: UserAiProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  savedAt?: string;
}

export interface ProviderPreset {
  id: UserAiProvider;
  name: string;
  shortName: string;
  badge: string;
  color: string;
  defaultModel: string;
  recommendedModels: Array<{ id: string; name: string; desc: string }>;
  placeholder: string;
  helpUrl: string;
  supportsCustomBaseUrl?: boolean;
}

