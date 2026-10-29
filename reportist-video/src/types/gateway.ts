// types/gateway.ts - AI Gateway 및 모델 관련 타입 정의

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
