// services/userApiKeyService.ts - 사용자 개인 AI API 키(BYOK) 로컬 스토리지 관리 및 프로바이더 프리셋

import type { ProviderPreset, UserAiProvider, UserApiKeyConfig } from '../types/gateway.ts';

const STORAGE_KEY = 'reportist_user_ai_key_config_v1';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    badge: 'GPT-4o',
    color: '#10a37f',
    defaultModel: 'gpt-4o-mini',
    recommendedModels: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', desc: '초고속 멀티모달 & 가성비 최적' },
      { id: 'gpt-4o', name: 'GPT-4o', desc: '플래그십 고지능 비전 분석' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    badge: 'Sonnet 3.7/3.5',
    color: '#d97706',
    defaultModel: 'claude-3-5-sonnet-20241022',
    recommendedModels: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', desc: '섬세한 감정선 및 클라이맥스 분석' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', desc: '하이브리드 추론 최신 플래그십' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: '초고속 경량 비전 모델' },
    ],
    placeholder: 'sk-ant-api03-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    badge: 'Gemini 2.0',
    color: '#2563eb',
    defaultModel: 'gemini-2.0-flash',
    recommendedModels: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: '실시간 초고속 비디오/프레임 인식' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', desc: '1M 대용량 컨텍스트 윈도우' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: '고정밀 심층 영상 분석' },
    ],
    placeholder: 'AIzaSy...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (올인원)',
    shortName: 'OpenRouter',
    badge: 'All-in-One',
    color: '#6366f1',
    defaultModel: 'openai/gpt-4o-mini',
    recommendedModels: [
      { id: 'openai/gpt-4o-mini', name: 'OpenAI: GPT-4o mini', desc: 'OpenRouter 경유 초고속' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet', desc: 'OpenRouter 경유 고지능' },
      { id: 'google/gemini-2.0-flash-001', name: 'Google: Gemini 2.0 Flash', desc: '차세대 멀티모달' },
      { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'NVIDIA: Nemotron 3.5 Super VL', desc: '무료 비전 플래그십' },
    ],
    placeholder: 'sk-or-v1-...',
    helpUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    badge: 'DeepSeek',
    color: '#0284c7',
    defaultModel: 'deepseek-chat',
    recommendedModels: [
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', desc: '압도적 가성비 & 정밀 JSON 출력' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', desc: '심층 추론 모델' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'grok',
    name: 'xAI (Grok)',
    shortName: 'Grok',
    badge: 'Grok Vision',
    color: '#475569',
    defaultModel: 'grok-2-vision-1212',
    recommendedModels: [
      { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', desc: 'xAI 고성능 시각 추론' },
      { id: 'grok-vision-beta', name: 'Grok Vision Beta', desc: '고속 멀티모달 베타' },
    ],
    placeholder: 'xai-...',
    helpUrl: 'https://console.x.ai/',
  },
  {
    id: 'qwen',
    name: 'Qwen (알리바바 통의천문)',
    shortName: 'Qwen',
    badge: 'Qwen-VL',
    color: '#ea580c',
    defaultModel: 'qwen-vl-max',
    recommendedModels: [
      { id: 'qwen-vl-max', name: 'Qwen VL Max', desc: '알리바바 최상위 비전 플래그십' },
      { id: 'qwen-vl-plus', name: 'Qwen VL Plus', desc: '초고속 이미지/영상 요약' },
      { id: 'qwen2.5-vl-72b-instruct', name: 'Qwen 2.5 VL 72B', desc: '오픈소스 최강 비전 인스트럭트' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://dashscope.console.aliyun.com/',
  },
  {
    id: 'glm',
    name: 'GLM (지푸 BigModel)',
    shortName: 'GLM',
    badge: 'GLM-4V',
    color: '#059669',
    defaultModel: 'glm-4v',
    recommendedModels: [
      { id: 'glm-4v', name: 'GLM-4V', desc: '고화질 이미지 시각 이해' },
      { id: 'glm-4v-plus', name: 'GLM-4V Plus', desc: '대규모 시퀀스 비디오 처리' },
    ],
    placeholder: '...',
    helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot AI)',
    shortName: 'Kimi',
    badge: 'Moonshot',
    color: '#7c3aed',
    defaultModel: 'moonshot-v1-auto',
    recommendedModels: [
      { id: 'moonshot-v1-auto', name: 'Moonshot V1 Auto', desc: '초장문 컨텍스트 윈도우' },
      { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', desc: '128K 연속 장면 분석' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    id: 'minimax',
    name: 'MiniMax (Mimo)',
    shortName: 'MiniMax',
    badge: 'MiniMax-VL',
    color: '#db2777',
    defaultModel: 'MiniMax-VL-01',
    recommendedModels: [
      { id: 'MiniMax-VL-01', name: 'MiniMax VL 01', desc: '미니맥스 멀티모달 비전' },
    ],
    placeholder: '...',
    helpUrl: 'https://platform.minimaxi.com/',
  },
  {
    id: 'muse',
    name: 'Muse AI',
    shortName: 'Muse',
    badge: 'Muse',
    color: '#8b5cf6',
    defaultModel: 'muse-v1',
    recommendedModels: [
      { id: 'muse-v1', name: 'Muse V1', desc: '미디어 크리에이티브 분석' },
    ],
    placeholder: '...',
    helpUrl: 'https://muse.ai/',
    supportsCustomBaseUrl: true,
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI 호환 규격)',
    shortName: 'Custom',
    badge: 'Custom',
    color: '#64748b',
    defaultModel: '',
    recommendedModels: [],
    placeholder: 'API Key 입력',
    helpUrl: '',
    supportsCustomBaseUrl: true,
  },
];

export function getStoredUserApiKeyConfig(): UserApiKeyConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserApiKeyConfig;
    if (parsed && typeof parsed.apiKey === 'string' && parsed.apiKey.trim()) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setStoredUserApiKeyConfig(config: UserApiKeyConfig): void {
  try {
    const payload: UserApiKeyConfig = {
      ...config,
      apiKey: config.apiKey.trim(),
      model: config.model?.trim() || '',
      baseUrl: config.baseUrl?.trim(),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[userApiKeyService] Failed to save API key to localStorage:', err);
  }
}

export function clearStoredUserApiKeyConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[userApiKeyService] Failed to clear API key from localStorage:', err);
  }
}

export function getProviderPreset(providerId?: UserAiProvider | string): ProviderPreset {
  const found = PROVIDER_PRESETS.find((p) => p.id === providerId);
  return found || PROVIDER_PRESETS[0];
}
