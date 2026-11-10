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

export type ReasoningEffortOption = 'high' | 'medium' | 'low' | 'minimal' | 'none' | 'max';

export interface GatewayConfig {
  baseUrl: string;
  gatewaySecret: string;
}
