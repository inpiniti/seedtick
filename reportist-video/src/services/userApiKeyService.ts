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
      { id: 'claude-fable-5-2-high', name: 'Claude Fable 5.2 (high)', desc: '초고성능 고속 추론 (Score 62)' },
      { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (max)', desc: '초대형 심층 영상/스토리라인 분석 (Score 59)' },
      { id: 'claude-opus-5-5-high', name: 'Claude Opus 5.5 (high)', desc: '심층 영상/장면 정밀 분석 (Score 52)' },
      { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (max)', desc: '균형 잡힌 최고성능 플래그십 (Score 55, 기본값)' },
      { id: 'claude-sonnet-5-5-high', name: 'Claude Sonnet 5.5 (high)', desc: '고성능 고속 멀티모달 (Score 42)' },
      { id: 'claude-fable-5-1', name: 'Claude Fable 5.1 (max)', desc: '고정밀 멀티모달 추론 (Score 49)' },
      { id: 'claude-fable-5-1-high', name: 'Claude Fable 5.1 (high)', desc: '고정밀 시퀀스 추론 (Score 47)' },
      { id: 'claude-opus-5', name: 'Claude Opus 5 (max)', desc: 'Opus 5세대 플래그십 (Score 44)' },
      { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (max)', desc: '초고속 경량 하이라이트 분석 (Score 36)' },
      { id: 'claude-haiku-5-5-high', name: 'Claude Haiku 5.5 (high)', desc: '초고속 경량 고효율 (Score 30)' },
      { id: 'claude-4-5-haiku', name: 'Claude 4.5 Haiku', desc: '이전 세대 초경량 모델 (Score 7)' },
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
      { id: 'gpt-6-astra-high', name: 'GPT-6 Astra (high)', desc: '지능형 고속 비디오 엔진 (Score 55)' },
      { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol (max)', desc: 'OpenAI 6.1 세대 플래그십 (Score 55, 기본값)' },
      { id: 'gpt-6.1-sol-high', name: 'GPT-6.1 Sol (high)', desc: '고성능 6.1 세대 엔진 (Score 50)' },
      { id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra (max)', desc: '고정밀 비전 & 멀티모달 (Score 51)' },
      { id: 'gpt-6.1-terra-high', name: 'GPT-6.1 Terra (high)', desc: '고정밀 멀티모달 (Score 42)' },
      { id: 'gpt-6-sol', name: 'GPT-6 Sol (max)', desc: 'GPT-6 세대 솔 플래그십 (Score 44)' },
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra (max)', desc: '5.6 세대 테라 비전 모델 (Score 32)' },
      { id: 'gpt-6.1-terra-nr', name: 'GPT-6.1 Terra (non-reasoning)', desc: '논추론 즉각 응답 비전 모델 (Score 31)' },
      { id: 'gpt-6-luna', name: 'GPT-6 Luna (max)', desc: '초경량 고효율 비전 모델 (Score 28)' },
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna (max)', desc: '5.6 세대 루나 경량 모델 (Score 24)' },
      { id: 'gpt-6-luna-high', name: 'GPT-6 Luna (high)', desc: '초경량 고속 비전 (Score 21)' },
      { id: 'gpt-6-luna-nr', name: 'GPT-6 Luna (non-reasoning)', desc: '초고속 논추론 루나 (Score 9)' },
      { id: 'gpt-oss-120b', name: 'gpt-oss-120b (high)', desc: 'OpenAI 오픈소스 120B 모델 (Score 4)' },
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
    color: '#0f172a',
    defaultModel: 'gemini-4-carbon',
    recommendedModels: [
      { id: 'gemini-4-carbon', name: 'Gemini 4 Carbon (high)', desc: '구글 최상위 비전 플래그십 (Score 60, 기본값)' },
      { id: 'gemini-4-carbon-medium', name: 'Gemini 4 Carbon (medium)', desc: '고성능 밸런스 비전 모델 (Score 58)' },
      { id: 'gemini-4-carbon-low', name: 'Gemini 4 Carbon (low)', desc: '고속 카본 비전 모델 (Score 54)' },
      { id: 'gemini-4-argon', name: 'Gemini 4 Argon (high)', desc: '차세대 아르곤 비전 플래그십 (Score 50)' },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (high)', desc: '초고속 실시간 프레임 분석 (Score 31)' },
      { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (medium)', desc: '고속 플래시 프레임 처리 (Score 30)' },
      { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (low)', desc: '초고속 저지연 플래시 (Score 23)' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', desc: '경량 초고속 프레임 처리 (Score 12)' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', desc: '초경량 플래시 라이트 (Score 6)' },
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
    color: '#1e293b',
    defaultModel: 'muse-wonder-full',
    recommendedModels: [
      { id: 'muse-wonder-full', name: 'Muse Wonder Full (max)', desc: 'Meta 차세대 플래그십 (Score 50, 기본값)' },
      { id: 'muse-wonder', name: 'Muse Wonder (max)', desc: '고속 멀티모달 비디오 엔진 (Score 44)' },
      { id: 'muse-wonder-high', name: 'Muse Wonder (high)', desc: '고성능 원더 비디오 엔진 (Score 41)' },
      { id: 'muse-spark-1.3', name: 'Muse Spark 1.3 (max)', desc: '미디어 스파크 1.3 플래그십 (Score 37)' },
      { id: 'muse-ember', name: 'Muse Ember (max)', desc: '초경량 고효율 미디어 분석 (Score 36)' },
      { id: 'muse-ember-xhigh', name: 'Muse Ember (xhigh)', desc: '고속 엠버 미디어 처리 (Score 34)' },
      { id: 'muse-spark-open', name: 'Muse Spark Open (xhigh)', desc: '오픈 스파크 모델 (Score 25)' },
      { id: 'muse-glimmer', name: 'Muse Glimmer (high)', desc: '초경량 글리머 엔진 (Score 6)' },
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
    color: '#0f172a',
    defaultModel: 'kimi-k3.1-pro',
    recommendedModels: [
      { id: 'kimi-k3.1-pro', name: 'Kimi K3.1 Pro', desc: '초장문 컨텍스트 & 시퀀스 분석 (Score 46, 기본값)' },
      { id: 'kimi-k3', name: 'Kimi K3 (low)', desc: '고속 K3 경량 분석 (Score 17)' },
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
      { id: 'grok-4.7', name: 'Grok 4.7 (xhigh)', desc: 'xAI 최신 비전 추론 모델 (Score 35, 기본값)' },
      { id: 'grok-4.7-high', name: 'Grok 4.7 (high)', desc: 'xAI 고성능 비전 추론 (Score 35)' },
      { id: 'grok-4.7-low', name: 'Grok 4.7 (low)', desc: '고속 비전 추론 (Score 31)' },
      { id: 'grok-4.6', name: 'Grok 4.6 (xhigh)', desc: 'Grok 4.6 세대 비전 모델 (Score 31)' },
      { id: 'grok-2-vision-1212', name: 'Grok 2 Vision', desc: '이전 세대 비전 모델' },
    ],
    placeholder: 'xai-...',
    helpUrl: 'https://console.x.ai/',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    badge: 'DeepSeek V4.1',
    color: '#1e293b',
    defaultModel: 'deepseek-v4.1-flash',
    recommendedModels: [
      { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash 1017 (max)', desc: '차세대 초고속 플래그십 (Score 33, 기본값)' },
      { id: 'deepseek-v4.1-flash-high', name: 'DeepSeek V4.1 Flash 1017 (high)', desc: '고성능 V4.1 플래시 (Score 29)' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro 0813 (max)', desc: 'DeepSeek V4 프로 심층 추론 (Score 23)' },
      { id: 'deepseek-v4.1-flash-nr', name: 'DeepSeek V4.1 Flash 1017 (non-reasoning)', desc: '초고속 논추론 플래시 (Score 19)' },
      { id: 'deepseek-v4-pro-nr', name: 'DeepSeek V4 Pro 0813 (non-reasoning)', desc: 'V4 프로 논추론 모델 (Score 13)' },
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', desc: '압도적 가성비 & 정밀 JSON' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', desc: '심층 추론 모델' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'qwen',
    name: 'Qwen (알리바바 통의천문)',
    shortName: 'Qwen',
    badge: 'Qwen 3.8',
    color: '#ea580c',
    defaultModel: 'qwen-3.8-max',
    recommendedModels: [
      { id: 'qwen-3.8-max', name: 'Qwen3.8 Max (0902)', desc: '알리바바 최신 최상위 플래그십 (Score 34, 기본값)' },
      { id: 'qwen-3.8-27b', name: 'Qwen3.8 27B (xhigh)', desc: '고효율 고속 비전 모델 (Score 20)' },
      { id: 'qwen2.5-vl-72b-instruct', name: 'Qwen 2.5 VL 72B', desc: '이전 세대 오픈소스 비전' },
    ],
    placeholder: 'sk-...',
    helpUrl: 'https://dashscope.console.aliyun.com/',
  },
  {
    id: 'glm',
    name: 'GLM (지푸 BigModel)',
    shortName: 'GLM',
    badge: 'GLM-5.3',
    color: '#059669',
    defaultModel: 'glm-5.3',
    recommendedModels: [
      { id: 'glm-5.3', name: 'GLM-5.3 (max)', desc: '최신 차세대 멀티모달 플래그십 (Score 32, 기본값)' },
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
      { id: 'mimo-v2.6-pro', name: 'MiMo-V2.6-Pro', desc: '미니맥스 최신 멀티모달 플래그십 (Score 30, 기본값)' },
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
    color: '#1e293b',
    defaultModel: 'anthropic/claude-sonnet-5.5',
    recommendedModels: [
      { id: 'anthropic/claude-fable-5.2', name: 'Anthropic: Claude Fable 5.2', desc: '벤치마크 1위 (Score 65)' },
      { id: 'google/gemini-4-carbon', name: 'Google: Gemini 4 Carbon', desc: '구글 비전 플래그십 (Score 60)' },
      { id: 'anthropic/claude-opus-5.5', name: 'Anthropic: Claude Opus 5.5', desc: '초대형 심층 영상 분석 (Score 59)' },
      { id: 'openai/gpt-6-astra', name: 'OpenAI: GPT-6 Astra', desc: 'OpenAI 최고 지능 비디오 (Score 57)' },
      { id: 'openai/gpt-6.1-sol', name: 'OpenAI: GPT-6.1 Sol', desc: 'OpenAI 6.1 플래그십 (Score 55)' },
      { id: 'anthropic/claude-sonnet-5.5', name: 'Anthropic: Claude Sonnet 5.5', desc: '차세대 밸런스 플래그십 (Score 55, 기본값)' },
      { id: 'meta/muse-wonder-full', name: 'Meta: Muse Wonder Full', desc: 'Meta 차세대 플래그십 (Score 50)' },
      { id: 'google/gemini-4-argon', name: 'Google: Gemini 4 Argon', desc: '구글 차세대 아르곤 비전 (Score 50)' },
      { id: 'moonshot/kimi-k3.1-pro', name: 'Moonshot: Kimi K3.1 Pro', desc: '초장문 시퀀스 분석 (Score 46)' },
      { id: 'xai/grok-4.7', name: 'xAI: Grok 4.7', desc: 'xAI 최신 비전 추론 (Score 35)' },
      { id: 'qwen/qwen-3.8-max', name: 'Qwen: Qwen3.8 Max', desc: '알리바바 최신 플래그십 (Score 34)' },
      { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek: DeepSeek V4.1 Flash', desc: 'DeepSeek 차세대 플래시 (Score 33)' },
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
