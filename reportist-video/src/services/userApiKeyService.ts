// services/userApiKeyService.ts - 사용자 개인 AI API 키(BYOK) 로컬 스토리지 관리 및 프로바이더 프리셋

import type { ProviderPreset, UserAiProvider, UserApiKeyConfig } from '../types/gateway.ts';

const STORAGE_KEY = 'reportist_user_ai_key_config_v1';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    badge: 'Claude 5.5 / Fable',
    color: '#d97706',
    defaultModel: 'claude-sonnet-5-5',
    recommendedModels: [
      { id: 'claude-fable-5-2', name: 'Claude Fable 5.2 (max)', desc: '벤치마크 1위 (Score 65) 압도적 최고 지능' },
      { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (max)', desc: '초대형 심층 영상/스토리라인 분석 (Score 59)' },
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (max)', desc: '균형 잡힌 최고성능 플래그십 (Score 55)' },
      { id: 'claude-fable-5-1', name: 'Claude Fable 5.1 (max)', desc: '고정밀 멀티모달 추론 (Score 49)' },
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (max)', desc: '초고속 경량 하이라이트 분석 (Score 36)' },
    ],
    placeholder: 'sk-ant-api03-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    badge: 'GPT-6 / 6.1',
    color: '#10a37f',
    defaultModel: 'gpt-6.1-sol',
    recommendedModels: [
      { id: 'gpt-6-astra', name: 'GPT-6 Astra (max)', desc: '최상위 지능형 비디오 엔진 (Score 57)' },
      { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol (max)', desc: 'OpenAI 6.1 세대 플래그십 (Score 55)' },
      { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra (max)', desc: '고정밀 비전 & 멀티모달 (Score 51)' },
      { id: 'gpt-6-luna', name: 'GPT-6 Luna (max)', desc: '초경량 고효율 비전 모델 (Score 28)' },
      { id: 'gpt-4o', name: 'GPT-4o', desc: '이전 세대 안정형 플래그십' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    badge: 'Gemini 4 / 3.8',
    color: '#2563eb',
    defaultModel: 'gemini-4-carbon',
    recommendedModels: [
      { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon (high)', desc: '구글 최상위 비전 플래그십 (Score 60)' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (high)', desc: '초고속 실시간 프레임 분석 (Score 31)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: '이전 세대 안정형 초고속 모델' },
    ],
    placeholder: 'AIzaSy...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'muse',
    name: 'Muse (Meta)',
    shortName: 'Muse',
    badge: 'Muse Wonder',
    color: '#0284c7',
    defaultModel: 'muse-wonder-full',
    recommendedModels: [
      { id: 'muse-wonder-full', name: 'Muse Wonder Full (max)', desc: 'Meta 차세대 플래그십 (Score 50)' },
      { id: 'muse-wonder', name: 'Muse Wonder (max)', desc: '고속 멀티모달 비디오 엔진 (Score 44)' },
      { id: 'muse-ember', name: 'Muse Ember (max)', desc: '초경량 고효율 미디어 분석 (Score 36)' },
    ],
    placeholder: '...',
    helpUrl: 'https://muse.ai/',
    supportsCustomBaseUrl: true,
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot AI)',
    shortName: 'Kimi',
    badge: 'Kimi K3.1',
    color: '#7c3aed',
    defaultModel: 'kimi-k3.1-pro',
    recommendedModels: [
      { id: 'kimi-k3.1-pro', name: 'Kimi K3.1 Pro', desc: '초장문 컨텍스트 & 시퀀스 분석 (Score 46)' },
      { id: 'moonshot-v1-auto', name: 'Moonshot V1 Auto', desc: '이전 세대 범용 모델' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    id: 'grok',
    name: 'xAI (Grok)',
    shortName: 'Grok',
    badge: 'Grok 4.7',
    color: '#475569',
    defaultModel: 'grok-4.7',
    recommendedModels: [
      { id: 'grok-4.7', name: 'Grok 4.7 (xhigh)', desc: 'xAI 최신 비전 추론 모델 (Score 35)' },
      { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', desc: '이전 세대 비전 모델' },
    ],
    placeholder: 'xai-...',
    helpUrl: 'https://console.x.ai/',
  },
  {
    id: 'qwen',
    name: 'Qwen (알리바바 통의천문)',
    shortName: 'Qwen',
    badge: 'Qwen 3.8',
    color: '#ea580c',
    defaultModel: 'qwen-3.8-max',
    recommendedModels: [
      { id: 'qwen-3.8-max', name: 'Qwen3.8 Max (0902)', desc: '알리바바 최신 최상위 플래그십 (Score 34)' },
      { id: 'qwen-3.8-27b', name: 'Qwen3.8 27B (xhigh)', desc: '고효율 고속 비전 모델 (Score 20)' },
      { id: 'qwen2.5-vl-72b-instruct', name: 'Qwen 2.5 VL 72B', desc: '이전 세대 오픈소스 비전' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://dashscope.console.aliyun.com/',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    badge: 'DeepSeek V4.1',
    color: '#0284c7',
    defaultModel: 'deepseek-v4.1-flash',
    recommendedModels: [
      { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash 1017 (max)', desc: '차세대 초고속 플래그십 (Score 33)' },
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', desc: '압도적 가성비 & 정밀 JSON' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', desc: '심층 추론 모델' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'glm',
    name: 'GLM (지푸 BigModel)',
    shortName: 'GLM',
    badge: 'GLM-5.3',
    color: '#059669',
    defaultModel: 'glm-5.3',
    recommendedModels: [
      { id: 'glm-5.3', name: 'GLM-5.3 (max)', desc: '최신 차세대 멀티모달 플래그십 (Score 32)' },
      { id: 'glm-4v', name: 'GLM-4V', desc: '이전 세대 비전 모델' },
    ],
    placeholder: '...',
    helpUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    id: 'minimax',
    name: 'MiniMax (Mimo)',
    shortName: 'MiniMax',
    badge: 'MiMo-V2.6',
    color: '#db2777',
    defaultModel: 'mimo-v2.6-pro',
    recommendedModels: [
      { id: 'mimo-v2.6-pro', name: 'MiMo-V2.6-Pro', desc: '미니맥스 최신 멀티모달 플래그십 (Score 30)' },
      { id: 'MiniMax-VL-01', name: 'MiniMax VL 01', desc: '이전 세대 비전 모델' },
    ],
    placeholder: '...',
    helpUrl: 'https://platform.minimaxi.com/',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (올인원)',
    shortName: 'OpenRouter',
    badge: 'All-in-One',
    color: '#6366f1',
    defaultModel: 'anthropic/claude-sonnet-5.5',
    recommendedModels: [
      { id: 'anthropic/claude-fable-5.2', name: 'Anthropic: Claude Fable 5.2', desc: '벤치마크 1위 (Score 65)' },
      { id: 'google/gemini-4-carbon', name: 'Google: Gemini 4 Carbon', desc: '구글 비전 플래그십 (Score 60)' },
      { id: 'openai/gpt-6-astra', name: 'OpenAI: GPT-6 Astra', desc: 'OpenAI 최고 지능 비디오 (Score 57)' },
      { id: 'openai/gpt-6.1-sol', name: 'OpenAI: GPT-6.1 Sol', desc: 'OpenAI 6.1 플래그십 (Score 55)' },
      { id: 'anthropic/claude-sonnet-5.5', name: 'Anthropic: Claude Sonnet 5.5', desc: '차세대 밸런스 플래그십 (Score 55)' },
      { id: 'qwen/qwen-3.8-max', name: 'Qwen: Qwen3.8 Max', desc: '알리바바 최신 플래그십 (Score 34)' },
    ],
    placeholder: 'sk-or-v1-...',
    helpUrl: 'https://openrouter.ai/keys',
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
