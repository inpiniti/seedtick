// types/chat.ts

export type MessageRole = 'system' | 'user' | 'assistant';

export type AttachmentType = 'image' | 'audio' | 'video' | 'file';

export interface ChatAttachment {
  id: string;
  type: AttachmentType;
  name: string;
  size: number;
  sizeFormatted: string;
  mimeType: string;
  dataUrl: string; // Base64 data URL
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoning?: string;
  attachments?: ChatAttachment[];
  isStreaming?: boolean;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId: string;
  reasoningEffort: ReasoningEffortOption;
  createdAt: number;
  updatedAt: number;
}

export type ReasoningEffortOption = 'none' | 'low' | 'medium' | 'high' | 'extra' | 'max';

export interface ReasoningEffortInfo {
  key: ReasoningEffortOption;
  label: string;
  englishLabel: string;
  description: string;
  badgeColor?: string;
}

export const REASONING_EFFORT_OPTIONS: ReasoningEffortInfo[] = [
  {
    key: 'none',
    label: '기본',
    englishLabel: 'Default',
    description: '모델의 기본 추론 설정을 사용해요 (빠른 기본 응답)',
  },
  {
    key: 'low',
    label: '낮음',
    englishLabel: 'Low',
    description: '핵심 위주로 가볍게 생각하여 신속하게 답변해요',
  },
  {
    key: 'medium',
    label: '중간',
    englishLabel: 'Medium',
    description: '논리와 속도의 균형을 맞춘 표준 추론을 진행해요',
  },
  {
    key: 'high',
    label: '높음',
    englishLabel: 'High',
    description: '단계별로 꼼꼼하게 검토하여 정확한 답변을 도출해요',
  },
  {
    key: 'extra',
    label: '엑스트라',
    englishLabel: 'Extra',
    description: '복잡한 문제 해결을 위해 더 깊이 있게 생각해요',
  },
  {
    key: 'max',
    label: '최대',
    englishLabel: 'Max',
    description: '가장 많은 추론 리소스를 투입하여 심층 분석해요',
  },
];

export interface FreeModelMeta {
  id: string;
  name: string;
  providerName: string;
  created: number;
  createdDate: string;
  daysAgo: number;
  contextLength: number;
  contextLengthFormatted: string;
  description: string;
  modality: string;
  inputModalities?: string[];
  intelligenceTier: string;
  parametersSummary: string;
  supportedParameters: string[];
}

export function getModelInputModalities(model?: FreeModelMeta | null): string[] {
  if (!model) return ['text'];
  if (Array.isArray(model.inputModalities) && model.inputModalities.length > 0) {
    return model.inputModalities;
  }
  if (model.modality && model.modality.includes('->')) {
    const inputs = model.modality.split('->')[0].split('+').map((s) => s.trim());
    return inputs.length > 0 ? inputs : ['text'];
  }
  return ['text'];
}

export interface GatewayConfig {
  baseUrl: string;
  gatewaySecret: string;
}
