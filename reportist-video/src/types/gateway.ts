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
  supportedEfforts?: string[];
  defaultEffort?: string | null;
  reasoningMandatory?: boolean;
  intelligenceTier?: string;
  parametersSummary?: string;
  supportedParameters?: string[];
}

export type ReasoningEffortOption = 'high' | 'medium' | 'low' | 'minimal' | 'none' | 'max';

export interface GatewayConfig {
  baseUrl: string;
  gatewaySecret: string;
}
