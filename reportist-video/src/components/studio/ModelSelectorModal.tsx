import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  Gauge,
  Key,
  Layers,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import type { FreeModelMeta, UserAiProvider, UserApiKeyConfig } from '../../types/gateway.ts';
import { getModelInputModalities } from '../../types/gateway.ts';
import {
  cleanModelName,
  compareModelsByIntelligence,
  getSpeedTier,
  pickDefaultModel,
} from '../../services/modelMetrics.ts';
import {
  clearStoredUserApiKeyConfig,
  getProviderPreset,
  getStoredUserApiKeyConfig,
  PROVIDER_PRESETS,
  setStoredUserApiKeyConfig,
} from '../../services/userApiKeyService.ts';
import { notify } from '../../services/toastService.ts';
import { useI18n } from '../../i18n/index.tsx';
import {
  localizeIntelligenceTier,
  localizeParametersSummary,
  localizeContextLength,
} from '../../i18n/modelLocalization.ts';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: FreeModelMeta[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

type SortKey = 'intelligence' | 'speed' | 'newest' | 'context';
type ModalityFilter = 'all' | 'image' | 'video' | 'audio';

function getProviderName(model: FreeModelMeta): string {
  return model.providerName || model.id.split('/')[0] || 'Other';
}

function formatIntelligence(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSpeed(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—';
  return Math.round(value).toLocaleString();
}

function formatLatency(value?: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—';
  const sec = value / 1000;
  if (sec >= 10) return sec.toFixed(1);
  if (sec >= 1) {
    const formatted = sec.toFixed(2);
    return formatted.endsWith('0') ? sec.toFixed(1) : formatted;
  }
  return sec.toFixed(2);
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  models,
  selectedModelId,
  onSelectModel,
}) => {
  const { dict, interpolate, locale } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedModality, setSelectedModality] = useState<ModalityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('intelligence');

  // BYOK (사용자 API Key 설정) 상태
  const [activeTab, setActiveTab] = useState<'gateway' | 'byok'>('gateway');
  const [storedUserKey, setStoredUserKey] = useState<UserApiKeyConfig | null>(null);
  const [selectedByokProvider, setSelectedByokProvider] = useState<UserAiProvider>('openai');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [modelInput, setModelInput] = useState<string>('');
  const [baseUrlInput, setBaseUrlInput] = useState<string>('');
  const [showKeyText, setShowKeyText] = useState<boolean>(false);

  // 모달이 열릴 때마다 로컬 스토리지에서 최신 설정 동기화
  useEffect(() => {
    if (!isOpen) return;
    const current = getStoredUserApiKeyConfig();
    setStoredUserKey(current);
    if (current) {
      setSelectedByokProvider(current.provider);
      setApiKeyInput(current.apiKey);
      setModelInput(current.model || '');
      setBaseUrlInput(current.baseUrl || '');
      setActiveTab('byok');
    } else {
      setActiveTab('gateway');
      const defaultPreset = getProviderPreset('openai');
      setSelectedByokProvider('openai');
      setApiKeyInput('');
      setModelInput(defaultPreset.defaultModel);
      setBaseUrlInput('');
    }
  }, [isOpen]);

  const currentPreset = useMemo(
    () => getProviderPreset(selectedByokProvider),
    [selectedByokProvider]
  );

  const handleSelectByokProvider = (providerId: UserAiProvider) => {
    setSelectedByokProvider(providerId);
    const preset = getProviderPreset(providerId);
    if (storedUserKey && storedUserKey.provider === providerId) {
      setApiKeyInput(storedUserKey.apiKey);
      setModelInput(storedUserKey.model || preset.defaultModel);
      setBaseUrlInput(storedUserKey.baseUrl || '');
    } else {
      setModelInput(preset.defaultModel);
      if (!preset.supportsCustomBaseUrl) {
        setBaseUrlInput('');
      }
    }
  };

  const handleSaveByok = () => {
    if (!apiKeyInput.trim()) {
      notify.warning('API Key를 입력해 주세요.');
      return;
    }

    const payload: UserApiKeyConfig = {
      provider: selectedByokProvider,
      apiKey: apiKeyInput.trim(),
      model: modelInput.trim() || currentPreset.defaultModel,
      baseUrl: currentPreset.supportsCustomBaseUrl && baseUrlInput.trim() ? baseUrlInput.trim() : undefined,
    };

    setStoredUserApiKeyConfig(payload);
    setStoredUserKey(payload);
    onSelectModel(payload.model);
    notify.success(`${currentPreset.name} API Key가 브라우저에 안전하게 저장되었습니다!`);
  };

  const handleClearByok = () => {
    clearStoredUserApiKeyConfig();
    setStoredUserKey(null);
    setApiKeyInput('');
    const defaultModel = models[0]?.id || 'nvidia/nemotron-3.5-super-vl:free';
    onSelectModel(defaultModel);
    notify.info('API Key가 삭제되었습니다. 기본 무료 게이트웨이 모델로 전환됩니다.');
  };

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.model-modal-list, [data-modal-scrollable="true"]',
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract provider list
  const providers = useMemo(() => {
    const set = new Set<string>();
    models.forEach((model) => set.add(getProviderName(model)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [models]);

  // Modality counts
  const modalityCounts = useMemo(() => {
    let image = 0;
    let video = 0;
    let audio = 0;
    for (const model of models) {
      const modalities = getModelInputModalities(model);
      if (modalities.includes('image')) image++;
      if (modalities.includes('video')) video++;
      if (modalities.includes('audio')) audio++;
    }
    return { all: models.length, image, video, audio };
  }, [models]);

  // Recommended (top intelligence default) model
  const recommendedModel = useMemo(() => pickDefaultModel(models), [models]);

  // Fastest model
  const fastestModel = useMemo(() => {
    let fastest: FreeModelMeta | null = null;
    let max = 0;
    for (const model of models) {
      if (model.speedTokensPerSecond && model.speedTokensPerSecond > max) {
        max = model.speedTokensPerSecond;
        fastest = model;
      }
    }
    return fastest;
  }, [models]);

  // Speed max benchmark
  const maxSpeed = useMemo(() => {
    let max = 1;
    for (const model of models) {
      if (model.speedTokensPerSecond && model.speedTokensPerSecond > max) {
        max = model.speedTokensPerSecond;
      }
    }
    return max;
  }, [models]);

  // Filtered and sorted models
  const displayedModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = models.filter((model) => {
      if (query) {
        const nameMatch = model.name.toLowerCase().includes(query);
        const idMatch = model.id.toLowerCase().includes(query);
        const providerMatch = getProviderName(model).toLowerCase().includes(query);
        const descMatch = (model.description || '').toLowerCase().includes(query);
        const tierMatch =
          localizeIntelligenceTier(model.intelligenceTier, locale).toLowerCase().includes(query) ||
          (model.intelligenceTier || '').toLowerCase().includes(query);
        const paramMatch =
          localizeParametersSummary(model.parametersSummary, locale).toLowerCase().includes(query) ||
          (model.parametersSummary || '').toLowerCase().includes(query);
        if (!nameMatch && !idMatch && !providerMatch && !descMatch && !tierMatch && !paramMatch) {
          return false;
        }
      }

      if (selectedProvider !== 'all' && getProviderName(model) !== selectedProvider) {
        return false;
      }

      if (selectedModality !== 'all') {
        const modalities = getModelInputModalities(model);
        if (!modalities.includes(selectedModality)) {
          return false;
        }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (a.id === selectedModelId) return -1;
      if (b.id === selectedModelId) return 1;

      if (sortKey === 'intelligence') {
        return compareModelsByIntelligence(a, b);
      }

      if (sortKey === 'speed') {
        const speedA = a.speedTokensPerSecond ?? 0;
        const speedB = b.speedTokensPerSecond ?? 0;
        if (speedB !== speedA) return speedB - speedA;
        return compareModelsByIntelligence(a, b);
      }

      if (sortKey === 'newest') {
        return (a.daysAgo ?? 9999) - (b.daysAgo ?? 9999);
      }

      if (sortKey === 'context') {
        return (b.contextLength ?? 0) - (a.contextLength ?? 0);
      }

      return compareModelsByIntelligence(a, b);
    });
  }, [models, searchQuery, selectedProvider, selectedModality, sortKey, selectedModelId]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="model-modal-backdrop"
      onClick={onClose}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className="model-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-modal-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <Sparkles size={20} color="#0f172a" />
            </div>
            <div>
              <h2 className="model-modal-title" id="model-modal-title">
                {dict.modelModal.title}
              </h2>
              <p className="model-modal-subtitle">
                {dict.modelModal.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector: Gateway vs BYOK (토스 세그먼티드 컨트롤 스타일) */}
        <div
          style={{
            margin: '12px 24px 0',
            padding: '4px',
            backgroundColor: '#f2f4f6',
            borderRadius: '12px',
            display: 'flex',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('gateway')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              padding: '9px 14px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: activeTab === 'gateway' ? '#ffffff' : 'transparent',
              color: activeTab === 'gateway' ? '#191f28' : '#8b95a1',
              boxShadow: activeTab === 'gateway' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
              fontSize: '13px',
              fontWeight: activeTab === 'gateway' ? 700 : 600,
              cursor: 'pointer',
              transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Sparkles size={15} color={activeTab === 'gateway' ? '#3182f6' : '#8b95a1'} />
            <span>AI Gateway 무료 모델</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('byok')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              padding: '9px 14px',
              borderRadius: '9px',
              border: 'none',
              backgroundColor: activeTab === 'byok' ? '#ffffff' : 'transparent',
              color: activeTab === 'byok' ? '#191f28' : '#8b95a1',
              boxShadow: activeTab === 'byok' ? '0 2px 6px rgba(0, 0, 0, 0.08)' : 'none',
              fontSize: '13px',
              fontWeight: activeTab === 'byok' ? 700 : 600,
              cursor: 'pointer',
              transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Key size={15} color={activeTab === 'byok' ? '#00a86b' : '#8b95a1'} />
            <span>내 API Key 연결 (BYOK)</span>
            {storedUserKey && (
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#00a86b',
                }}
              />
            )}
          </button>
        </div>

        {activeTab === 'byok' ? (
          /* === BYOK (내 API Key 설정 화면 - 토스 스타일 라이트 테마) === */
          <div
            className="model-modal-list"
            data-modal-scrollable="true"
            style={{
              padding: '16px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              maxHeight: 'calc(85vh - 180px)',
              backgroundColor: '#ffffff',
            }}
          >
            {/* 연결 상태 안내 카드 */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                backgroundColor: storedUserKey ? '#e6f9f0' : '#e8f3ff',
                border: storedUserKey ? '1px solid #bbf2d8' : '1px solid #cfe5ff',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {storedUserKey ? (
                <CheckCircle2 size={20} color="#00a86b" style={{ flexShrink: 0 }} />
              ) : (
                <Server size={20} color="#3182f6" style={{ flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: storedUserKey ? '#008252' : '#1b64da' }}>
                  {storedUserKey
                    ? `현재 ${getProviderPreset(storedUserKey.provider).name} (${storedUserKey.model}) 연결됨`
                    : '내 API Key를 등록하여 플래그십 AI로 하이라이트 분석'}
                </div>
                <div style={{ fontSize: '12px', color: '#4e5968', marginTop: '3px', lineHeight: 1.45 }}>
                  {storedUserKey
                    ? '브라우저에 안전하게 저장되어 있으며 새로고침해도 유지됩니다. 하이라이트 분석 시 개인 키로 직접 처리됩니다.'
                    : 'OpenAI, Claude, Gemini 등의 개인 API Key를 넣으면 분당 제한 없이 고화질 멀티모달 분석을 이용할 수 있습니다.'}
                </div>
              </div>
            </div>

            {/* 1. 제공사 선택 그리드 */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#191f28',
                  marginBottom: '8px',
                }}
              >
                1. AI 제공사 선택
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: '8px',
                }}
              >
                {PROVIDER_PRESETS.map((preset) => {
                  const isSelected = selectedByokProvider === preset.id;
                  const isSavedProvider = storedUserKey?.provider === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectByokProvider(preset.id)}
                      style={{
                        padding: '11px 12px',
                        borderRadius: '12px',
                        backgroundColor: isSelected ? '#ffffff' : '#f8fafc',
                        border: isSelected ? '2px solid #3182f6' : '1px solid #e5e8eb',
                        boxShadow: isSelected ? '0 4px 12px rgba(49, 130, 246, 0.12)' : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        position: 'relative',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: isSelected ? '#1b64da' : '#191f28' }}>
                          {preset.shortName}
                        </span>
                        {isSavedProvider && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '5px',
                              backgroundColor: '#e6f9f0',
                              color: '#00a86b',
                              fontWeight: 700,
                            }}
                          >
                            저장됨
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '10.5px',
                          color: preset.color,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {preset.badge}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. API Key 입력 폼 */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e5e8eb',
                borderRadius: '16px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#191f28' }}>
                  2. {currentPreset.name} API Key 입력
                </label>
                {currentPreset.helpUrl && (
                  <a
                    href={currentPreset.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: '#3182f6',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <span>키 발급받기</span>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>

              {/* Input row */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showKeyText ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={currentPreset.placeholder}
                  style={{
                    width: '100%',
                    padding: '11px 85px 11px 14px',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1d6db',
                    color: '#191f28',
                    fontSize: '13.5px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowKeyText(!showKeyText)}
                    style={{
                      padding: '5px',
                      borderRadius: '6px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#8b95a1',
                      cursor: 'pointer',
                    }}
                    title={showKeyText ? '숨기기' : '표시'}
                  >
                    {showKeyText ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clip = await navigator.clipboard.readText();
                        if (clip) setApiKeyInput(clip.trim());
                      } catch {}
                    }}
                    style={{
                      padding: '5px 9px',
                      borderRadius: '7px',
                      backgroundColor: '#f2f4f6',
                      border: '1px solid #e5e8eb',
                      color: '#4e5968',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    붙여넣기
                  </button>
                </div>
              </div>

              {/* 3. 모델 선택 */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#191f28', marginBottom: '6px' }}>
                  3. 모델 지정 (영상 하이라이트 분석용)
                </label>
                {currentPreset.recommendedModels.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {currentPreset.recommendedModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModelInput(m.id)}
                        style={{
                          padding: '6px 11px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          backgroundColor: modelInput === m.id ? '#e8f3ff' : '#ffffff',
                          border: modelInput === m.id ? '1.5px solid #3182f6' : '1px solid #e5e8eb',
                          color: modelInput === m.id ? '#1b64da' : '#4e5968',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title={m.desc}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  placeholder="직접 모델 ID 입력 (예: gpt-4o, claude-3-5-sonnet-20241022)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #d1d6db',
                    color: '#191f28',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
              </div>

              {/* 4. 커스텀 Base URL (필요시) */}
              {(currentPreset.supportsCustomBaseUrl || selectedByokProvider === 'custom') && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#191f28', marginBottom: '4px' }}>
                    커스텀 엔드포인트 URL (선택)
                  </label>
                  <input
                    type="text"
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    placeholder="https://api.example.com/v1/chat/completions"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #d1d6db',
                      color: '#191f28',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* 저장 및 삭제 버튼 */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleSaveByok}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: '#00a86b',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(0, 168, 107, 0.22)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Key size={15} />
                  <span>브라우저에 저장하고 연결하기</span>
                </button>
                {storedUserKey && (
                  <button
                    type="button"
                    onClick={handleClearByok}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '12px 18px',
                      borderRadius: '12px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#e11d48',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="키 삭제"
                  >
                    <Trash2 size={15} />
                    <span>삭제</span>
                  </button>
                )}
              </div>
            </div>

            {/* 보안 및 CORS 원천 차단 안내 카드 */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e5e8eb',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px',
                color: '#6b7684',
                lineHeight: 1.55,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3182f6', fontWeight: 700, fontSize: '12.5px' }}>
                <ShieldCheck size={15} />
                <span>안심 보안 & CORS(Origin) 오류 원천 방지 안내</span>
              </div>
              <div>
                • <strong>CORS 에러 제로</strong>: 브라우저에서 직접 AI 제공자로 요청하지 않고 AI Gateway의 보안 패스스루 터널을 거치므로 Origin 차단 오류 없이 안정적으로 호출됩니다.
              </div>
              <div>
                • <strong>로컬 보관 (Zero DB Storage)</strong>: 입력하신 API Key는 사용자 브라우저의 <code style={{ backgroundColor: '#e5e8eb', color: '#191f28', padding: '1px 5px', borderRadius: '4px', fontSize: '11px' }}>localStorage</code>에만 보관되며 서버 데이터베이스나 로그에 영구 저장되지 않습니다.
              </div>
            </div>
          </div>
        ) : (
          /* === 기본 무료 게이트웨이 모델 목록 (기존 뷰) === */
          <>
            {/* Search & Filter */}
            <div className="model-modal-search-section">
              <div className="model-modal-search-wrapper">
                <Search size={18} className="model-modal-search-icon" />
                <input
              type="text"
              placeholder={dict.modelModal.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="model-modal-search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="model-modal-clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label={dict.common.delete}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort bar */}
          <div className="model-modal-filter-row">
            <span className="model-modal-filter-label">{dict.modelModal.sortLabel}:</span>
            <div className="model-modal-chips">
              <button
                type="button"
                className={`model-modal-chip ${sortKey === 'intelligence' ? 'active' : ''}`}
                onClick={() => setSortKey('intelligence')}
              >
                🧠 {dict.modelModal.sortIntelligence}
              </button>
              <button
                type="button"
                className={`model-modal-chip ${sortKey === 'speed' ? 'active' : ''}`}
                onClick={() => setSortKey('speed')}
              >
                ⚡ {dict.modelModal.sortSpeed}
              </button>
              <button
                type="button"
                className={`model-modal-chip ${sortKey === 'newest' ? 'active' : ''}`}
                onClick={() => setSortKey('newest')}
              >
                🕒 {dict.modelModal.sortNewest}
              </button>
              <button
                type="button"
                className={`model-modal-chip ${sortKey === 'context' ? 'active' : ''}`}
                onClick={() => setSortKey('context')}
              >
                📚 {dict.modelModal.sortContext}
              </button>
            </div>
          </div>

          {/* Modality filter */}
          <div className="model-modal-filter-row">
            <span className="model-modal-filter-label">{dict.modelModal.filterModality}:</span>
            <div className="model-modal-chips">
              <button
                type="button"
                className={`model-modal-chip ${selectedModality === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedModality('all')}
              >
                {interpolate(dict.modelModal.filterAll, { count: modalityCounts.all })}
              </button>
              <button
                type="button"
                className={`model-modal-chip ${selectedModality === 'image' ? 'active' : ''}`}
                onClick={() => setSelectedModality('image')}
              >
                🖼️ {interpolate(dict.modelModal.filterImage, { count: modalityCounts.image })}
              </button>
              <button
                type="button"
                className={`model-modal-chip ${selectedModality === 'video' ? 'active' : ''}`}
                onClick={() => setSelectedModality('video')}
              >
                🎬 {interpolate(dict.modelModal.filterVideo, { count: modalityCounts.video })}
              </button>
              <button
                type="button"
                className={`model-modal-chip ${selectedModality === 'audio' ? 'active' : ''}`}
                onClick={() => setSelectedModality('audio')}
              >
                🎙️ {interpolate(dict.modelModal.filterAudio, { count: modalityCounts.audio })}
              </button>
            </div>
          </div>

          {/* Provider chips */}
          <div className="model-modal-provider-chips">
            <button
              type="button"
              className={`model-modal-provider-chip ${selectedProvider === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedProvider('all')}
            >
              {dict.modelModal.providerAll} ({models.length})
            </button>
            {providers.map((provider) => {
              const count = models.filter((model) => getProviderName(model) === provider).length;
              return (
                <button
                  key={provider}
                  type="button"
                  className={`model-modal-provider-chip ${selectedProvider === provider ? 'active' : ''}`}
                  onClick={() => setSelectedProvider(provider)}
                >
                  {provider} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Card List */}
        <div
          className="model-modal-list"
          data-modal-scrollable="true"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {displayedModels.length === 0 ? (
            <div className="model-modal-empty">
              <Brain size={36} color="#8b95a1" />
              <p className="model-modal-empty-title">{dict.modelModal.noModels}</p>
              <p className="model-modal-empty-desc">
                {dict.modelModal.searchPlaceholder}
              </p>
            </div>
          ) : (
            displayedModels.map((model) => {
              const isSelected = model.id === selectedModelId;
              const isRecommended = recommendedModel?.id === model.id;
              const isFastest = fastestModel?.id === model.id && !isRecommended;
              const isNew = (model.daysAgo ?? 9999) <= 14;
              const inputModalities = getModelInputModalities(model);
              const speedTier = getSpeedTier(model.speedTokensPerSecond);
              const speedPercent = model.speedTokensPerSecond
                ? Math.max(
                    4,
                    Math.min(
                      100,
                      Math.round((model.speedTokensPerSecond / maxSpeed) * 100)
                    )
                  )
                : 0;

              return (
                <div
                  key={model.id}
                  className={`model-modal-model-card ${isSelected ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectModel(model.id);
                    onClose();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectModel(model.id);
                      onClose();
                    }
                  }}
                >
                  <div className="model-modal-card-top">
                    <div className="model-modal-name-group">
                      <span className="model-modal-provider-badge">
                        {getProviderName(model)}
                      </span>
                      <h3 className="model-modal-model-name">
                        {cleanModelName(model.name)}
                      </h3>
                      {isRecommended && (
                        <span className="model-modal-fastest-badge">
                          <Sparkles size={11} />
                          {dict.modelModal.badgeRecommended}
                        </span>
                      )}
                      {isFastest && (
                        <span className="model-modal-fastest-badge">
                          <Zap size={11} />
                          {dict.modelModal.badgeFastest}
                        </span>
                      )}
                      {isNew && <span className="model-modal-new-badge">{dict.modelModal.badgeNew}</span>}
                      {model.dataPolicy?.training === false && (
                        <span
                          className="model-modal-fastest-badge"
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#059669',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                          }}
                          title={dict.modelModal.privacyNoTrainingTip || '이 모델은 입력 데이터를 학습에 사용하지 않습니다.'}
                        >
                          <ShieldCheck size={11} />
                          {dict.modelModal.privacyNoTraining ?? '학습 미사용'}
                        </span>
                      )}
                      {model.dataPolicy?.training === true && (
                        <span
                          className="model-modal-fastest-badge"
                          style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            color: '#d97706',
                            borderColor: 'rgba(245, 158, 11, 0.3)',
                          }}
                          title={dict.modelModal.privacyTrainingTip || '주의: 이 엔드포인트는 데이터가 모델 학습에 사용될 수 있습니다.'}
                        >
                          <ShieldAlert size={11} />
                          {dict.modelModal.privacyTraining ?? '학습에 사용됨'}
                        </span>
                      )}
                    </div>

                    <div className="model-modal-select-indicator">
                      {isSelected ? (
                        <div className="model-modal-check-badge selected">
                          <Check size={16} color="#ffffff" />
                        </div>
                      ) : (
                        <div className="model-modal-check-badge unselected" />
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="model-modal-metrics">
                    <div className="model-modal-metric intelligence">
                      <div className="model-modal-metric-label">
                        <Brain size={12} />
                        <span>{dict.modelModal.metricIntelligence}</span>
                      </div>
                      <div className="model-modal-metric-value">
                        <strong>{formatIntelligence(model.intelligenceIndex)}</strong>
                        <span>{model.intelligenceIndex != null ? 'AA' : '—'}</span>
                      </div>
                    </div>

                    <div className="model-modal-metric speed">
                      <div className="model-modal-metric-label">
                        <Gauge size={12} />
                        <span>{dict.modelModal.metricSpeed}</span>
                      </div>
                      <div className="model-modal-metric-value">
                        <strong>{formatSpeed(model.speedTokensPerSecond)}</strong>
                        <span>{model.speedTokensPerSecond != null && model.speedTokensPerSecond > 0 ? dict.modelModal.speedUnit : '—'}</span>
                      </div>
                    </div>

                    <div className="model-modal-metric latency">
                      <div className="model-modal-metric-label">
                        <Timer size={12} />
                        <span>{dict.modelModal.metricTtft}</span>
                      </div>
                      <div className="model-modal-metric-value">
                        <strong>{formatLatency(model.latencyMs)}</strong>
                        <span>{model.latencyMs != null && model.latencyMs > 0 ? dict.modelModal.ttftUnit : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Speed bar */}
                  {model.speedTokensPerSecond != null && model.speedTokensPerSecond > 0 && (
                    <div className="model-modal-speed-row">
                      <div className="model-modal-speed-track">
                        <div
                          className={`model-modal-speed-fill ${speedTier.key}`}
                          style={{ width: `${speedPercent}%` }}
                        />
                      </div>
                      <span className={`model-modal-speed-tier ${speedTier.key}`}>
                        {dict.modelModal.speedTiers[speedTier.key]}
                      </span>
                    </div>
                  )}

                  {/* Metadata tags */}
                  <div className="model-modal-tags">
                    {model.codingIndex != null && (
                      <div className="model-modal-tag coding">
                        <Cpu size={12} />
                        <span>
                          {dict.modelModal.tagCoding} <strong>{formatIntelligence(model.codingIndex)}</strong>
                        </span>
                      </div>
                    )}

                    {model.supportedEfforts && model.supportedEfforts.length > 0 && (
                      <div className="model-modal-tag effort">
                        <Zap size={12} />
                        <span>{dict.modelModal.tagEffort} {model.supportedEfforts.join('·')}</span>
                      </div>
                    )}

                    {inputModalities.includes('image') && (
                      <span className="model-modal-tag modality image">🖼️ {dict.modelModal.modalityImage}</span>
                    )}
                    {inputModalities.includes('video') && (
                      <span className="model-modal-tag modality video">🎬 {dict.modelModal.modalityVideo}</span>
                    )}
                    {inputModalities.includes('audio') && (
                      <span className="model-modal-tag modality audio">🎙️ {dict.modelModal.modalityAudio}</span>
                    )}
                    {!inputModalities.includes('image') &&
                      !inputModalities.includes('video') &&
                      !inputModalities.includes('audio') && (
                        <span className="model-modal-tag modality text">📝 {dict.modelModal.modalityText}</span>
                      )}

                    {model.createdDate && (
                      <div className="model-modal-tag date">
                        <Calendar size={12} />
                        <span>{model.createdDate}</span>
                      </div>
                    )}

                    {model.intelligenceTier && (
                      <div className="model-modal-tag tier">
                        <Brain size={12} />
                        <span>{localizeIntelligenceTier(model.intelligenceTier, locale)}</span>
                      </div>
                    )}

                    {model.parametersSummary && model.parametersSummary !== 'N/A' && (
                      <div className="model-modal-tag param">
                        <Cpu size={12} />
                        <span>{localizeParametersSummary(model.parametersSummary, locale)}</span>
                      </div>
                    )}

                    {model.contextLengthFormatted && (
                      <div className="model-modal-tag context">
                        <Layers size={12} />
                        <span>{localizeContextLength(model.contextLengthFormatted, locale)}</span>
                      </div>
                    )}

                    {/* Data Policy & Privacy Badge */}
                    {model.dataPolicy && (
                      <>
                        {model.dataPolicy.training === false ? (
                          <div
                            className="model-modal-tag privacy-safe"
                            title={dict.modelModal.privacyNoTrainingTip || '이 모델 제공사는 입력된 영상/데이터를 모델 학습에 사용하지 않습니다.'}
                          >
                            <ShieldCheck size={12} color="#10b981" />
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              {dict.modelModal.privacyNoTraining ?? '학습 미사용'}
                            </span>
                          </div>
                        ) : model.dataPolicy.training === true ? (
                          <div
                            className="model-modal-tag privacy-warning"
                            title={dict.modelModal.privacyTrainingTip || '주의: 이 무료 엔드포인트는 입력된 데이터가 모델 학습에 활용될 수 있습니다.'}
                          >
                            <ShieldAlert size={12} color="#f59e0b" />
                            <span style={{ color: '#d97706', fontWeight: 600 }}>
                              {dict.modelModal.privacyTraining ?? '학습에 사용됨'}
                            </span>
                          </div>
                        ) : null}

                        {model.dataPolicy.retainsPrompts === false ? (
                          <div
                            className="model-modal-tag privacy-zdr"
                            title={dict.modelModal.privacyZdrTip || '요청 완료 후 데이터가 서버에 일체 보관되지 않고 즉시 삭제됩니다 (Zero Data Retention).'}
                          >
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              🛡️ {dict.modelModal.privacyZdr ?? '즉시 삭제 (ZDR)'}
                            </span>
                          </div>
                        ) : model.dataPolicy.retainsPrompts === true ? (
                          <div
                            className="model-modal-tag privacy-retention"
                            title={interpolate(
                              dict.modelModal.privacyRetentionTip ||
                                '서버 보안 및 악용 방지 로그 목적으로 {days}일간 임시 보관된 후 삭제됩니다.',
                              { days: model.dataPolicy.retentionDays || 30 }
                            )}
                          >
                            <span style={{ color: '#4b5563' }}>
                              ⏱️ {typeof model.dataPolicy.retentionDays === 'number' && model.dataPolicy.retentionDays > 0
                                ? interpolate(dict.modelModal.privacyRetention ?? '보관 {days}일', {
                                    days: model.dataPolicy.retentionDays,
                                  })
                                : (dict.modelModal.privacyRetained30d ?? '보관 30일')}
                            </span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  {model.description && (
                    <p className="model-modal-desc">{model.description}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
        </>
        )}

        {/* Modal Footer */}
        <div className="model-modal-footer">
          <div className="model-modal-footer-tip">
            <Sparkles size={14} color="#0f172a" />
            <span>
              {dict.modelModal.benchmarkTip}
            </span>
          </div>
          <button type="button" className="model-modal-confirm-btn" onClick={onClose}>
            {dict.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
