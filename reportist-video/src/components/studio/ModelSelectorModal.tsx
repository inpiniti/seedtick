// components/studio/ModelSelectorModal.tsx - 영상 분석용 AI 모델 선택 모달
//
// reportist-chat의 모델 선택 UI와 동일한 카드형 레이아웃에
// 지능 지수 · 출력 속도(tok/s) · 레이턴시(TTFT)를 함께 보여준다.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  Calendar,
  Check,
  Cpu,
  Gauge,
  Layers,
  Search,
  Sparkles,
  Timer,
  X,
  Zap,
} from 'lucide-react';
import type { FreeModelMeta } from '../../types/gateway.ts';
import { getModelInputModalities } from '../../types/gateway.ts';
import {
  getSpeedTier,
  pickDefaultModel,
} from '../../services/modelMetrics.ts';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: FreeModelMeta[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

type SortKey = 'speed' | 'intelligence' | 'newest' | 'context';
type ModalityFilter = 'all' | 'image' | 'video' | 'audio';

function getProviderName(model: FreeModelMeta): string {
  return model.providerName || model.id.split('/')[0] || '기타';
}

function formatIntelligence(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSpeed(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString();
}

function formatLatency(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return (value / 1000).toFixed(2);
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  models,
  selectedModelId,
  onSelectModel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedModality, setSelectedModality] = useState<ModalityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('speed');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 제조사 목록 추출
  const providers = useMemo(() => {
    const set = new Set<string>();
    models.forEach((model) => set.add(getProviderName(model)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [models]);

  // 입력 모달리티별 모델 수 계산
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

  // 가장 빠른 모델 (기본 선택 대상)
  const fastestModel = useMemo(() => pickDefaultModel(models), [models]);
  const maxSpeed = useMemo(
    () => Math.max(1, ...models.map((model) => model.speedTokensPerSecond ?? 0)),
    [models]
  );

  // 필터링 및 정렬된 모델 목록
  const displayedModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = models.filter((model) => {
      const matchQuery =
        !query ||
        [
          model.name,
          model.id,
          model.description,
          model.intelligenceTier,
          getProviderName(model),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchProvider =
        selectedProvider === 'all' || getProviderName(model) === selectedProvider;

      const modalities = getModelInputModalities(model);
      const matchModality =
        selectedModality === 'all' || modalities.includes(selectedModality);

      return matchQuery && matchProvider && matchModality;
    });

    return filtered.sort((a, b) => {
      if (sortKey === 'speed') {
        const speedA = a.speedTokensPerSecond ?? 0;
        const speedB = b.speedTokensPerSecond ?? 0;
        if (speedB !== speedA) return speedB - speedA;

        const latencyA = a.latencyMs ?? Number.POSITIVE_INFINITY;
        const latencyB = b.latencyMs ?? Number.POSITIVE_INFINITY;
        if (latencyA !== latencyB) return latencyA - latencyB;

        return (b.intelligenceIndex ?? 0) - (a.intelligenceIndex ?? 0);
      }

      if (sortKey === 'intelligence') {
        const intelA = a.intelligenceIndex ?? -1;
        const intelB = b.intelligenceIndex ?? -1;
        if (intelB !== intelA) return intelB - intelA;
        return (a.daysAgo ?? 9999) - (b.daysAgo ?? 9999);
      }

      if (sortKey === 'context') {
        return (b.contextLength ?? 0) - (a.contextLength ?? 0);
      }

      // 'newest' (최신순)
      return (a.daysAgo ?? 9999) - (b.daysAgo ?? 9999);
    });
  }, [models, searchQuery, selectedProvider, selectedModality, sortKey]);

  if (!isOpen) return null;

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <Sparkles size={20} color="#3182f6" />
            </div>
            <div>
              <h2 className="model-modal-title" id="model-modal-title">
                AI 모델 선택하기
              </h2>
              <p className="model-modal-subtitle">
                영상 하이라이트 분석용 비전 모델 {models.length}개의 지능·속도·레이턴시를 한눈에 비교해 보세요
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label="모델 선택창 닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* 검색 및 필터 */}
        <div className="model-modal-search-section">
          <div className="model-modal-search-wrapper">
            <Search size={18} className="model-modal-search-icon" />
            <input
              type="text"
              placeholder="모델명, 제조사, 특징으로 검색해 보세요"
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
                aria-label="검색어 지우기"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 정렬 옵션 바 */}
          <div className="model-modal-filter-row">
            <span className="model-modal-filter-label">정렬 기준:</span>
            <div className="model-modal-chips">
              <button
                type="button"
                className={`model-modal-chip ${sortKey === 'speed' ? 'active' : ''}`}
                onClick={() => setSortKey('speed')}
              >
                ⚡ 빠른 순
              </button>
              <button
                type="button"
                className={`model-modal-chip ${sortKey === 'intelligence' ? 'active' : ''}`}
                onClick={() => setSortKey('intelligence')}
              >
                🧠 지능 높은 순
              </button>
              <button
                type="button"
                className={`model-modal-chip ${sortKey === 'newest' ? 'active' : ''}`}
                onClick={() => setSortKey('newest')}
              >
                🕒 최신순
              </button>
              <button
                type="button"
                className={`model-modal-chip ${sortKey === 'context' ? 'active' : ''}`}
                onClick={() => setSortKey('context')}
              >
                📚 문맥 길이순
              </button>
            </div>
          </div>

          {/* 입력 모달리티 필터 */}
          <div className="model-modal-filter-row">
            <span className="model-modal-filter-label">입력 지원:</span>
            <div className="model-modal-chips">
              <button
                type="button"
                className={`model-modal-chip ${selectedModality === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedModality('all')}
              >
                전체 ({modalityCounts.all})
              </button>
              <button
                type="button"
                className={`model-modal-chip ${selectedModality === 'image' ? 'active' : ''}`}
                onClick={() => setSelectedModality('image')}
              >
                🖼️ 이미지 ({modalityCounts.image})
              </button>
              <button
                type="button"
                className={`model-modal-chip ${selectedModality === 'video' ? 'active' : ''}`}
                onClick={() => setSelectedModality('video')}
              >
                🎬 비디오 ({modalityCounts.video})
              </button>
              <button
                type="button"
                className={`model-modal-chip ${selectedModality === 'audio' ? 'active' : ''}`}
                onClick={() => setSelectedModality('audio')}
              >
                🎙️ 오디오 ({modalityCounts.audio})
              </button>
            </div>
          </div>

          {/* 제조사 필터 칩 */}
          <div className="model-modal-provider-chips">
            <button
              type="button"
              className={`model-modal-provider-chip ${selectedProvider === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedProvider('all')}
            >
              제조사 전체 ({models.length})
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

        {/* 모델 카드 리스트 */}
        <div className="model-modal-list">
          {displayedModels.length === 0 ? (
            <div className="model-modal-empty">
              <Brain size={36} color="#8b95a1" />
              <p className="model-modal-empty-title">일치하는 모델이 없어요</p>
              <p className="model-modal-empty-desc">
                검색어나 입력 지원/제조사 필터를 다시 확인해 주세요
              </p>
            </div>
          ) : (
            displayedModels.map((model) => {
              const isSelected = model.id === selectedModelId;
              const isFastest = fastestModel?.id === model.id;
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
                        {model.name.replace(':free', '')}
                      </h3>
                      {isFastest && (
                        <span className="model-modal-fastest-badge">
                          <Zap size={11} />
                          가장 빠름
                        </span>
                      )}
                      {isNew && <span className="model-modal-new-badge">NEW</span>}
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

                  {/* 지능 · 속도 · 레이턴시 핵심 지표 */}
                  <div className="model-modal-metrics">
                    <div className="model-modal-metric intelligence">
                      <div className="model-modal-metric-label">
                        <Brain size={12} />
                        <span>지능 지수</span>
                      </div>
                      <div className="model-modal-metric-value">
                        <strong>{formatIntelligence(model.intelligenceIndex)}</strong>
                        <span>{model.intelligenceIndex != null ? 'AA' : '측정 전'}</span>
                      </div>
                    </div>

                    <div className="model-modal-metric speed">
                      <div className="model-modal-metric-label">
                        <Gauge size={12} />
                        <span>출력 속도</span>
                      </div>
                      <div className="model-modal-metric-value">
                        <strong>{formatSpeed(model.speedTokensPerSecond)}</strong>
                        <span>tok/s</span>
                      </div>
                    </div>

                    <div className="model-modal-metric latency">
                      <div className="model-modal-metric-label">
                        <Timer size={12} />
                        <span>레이턴시</span>
                      </div>
                      <div className="model-modal-metric-value">
                        <strong>{formatLatency(model.latencyMs)}</strong>
                        <span>초 TTFT</span>
                      </div>
                    </div>
                  </div>

                  {/* 상대 속도 바 */}
                  <div className="model-modal-speed-row">
                    <div className="model-modal-speed-track">
                      <div
                        className={`model-modal-speed-fill ${speedTier.key}`}
                        style={{ width: `${speedPercent}%` }}
                      />
                    </div>
                    <span className={`model-modal-speed-tier ${speedTier.key}`}>
                      {speedTier.label}
                    </span>
                    {model.speedIsEstimate && (
                      <span
                        className="model-modal-estimate-badge"
                        title="활성 파라미터 수를 기준으로 한 추정치예요"
                      >
                        추정
                      </span>
                    )}
                  </div>

                  {/* 모델 특징 메타 태그들 */}
                  <div className="model-modal-tags">
                    {model.codingIndex != null && (
                      <div
                        className="model-modal-tag coding"
                        title={`Artificial Analysis 코딩 지수: ${model.codingIndex}점`}
                      >
                        <Cpu size={12} />
                        <span>
                          코딩 <strong>{formatIntelligence(model.codingIndex)}</strong>
                        </span>
                      </div>
                    )}

                    {model.supportedEfforts && model.supportedEfforts.length > 0 && (
                      <div
                        className="model-modal-tag effort"
                        title={`지원 추론 노력: ${model.supportedEfforts.join(', ')}`}
                      >
                        <Zap size={12} />
                        <span>노력 {model.supportedEfforts.join('·')}</span>
                      </div>
                    )}

                    {inputModalities.includes('image') && (
                      <span className="model-modal-tag modality image">🖼️ 이미지</span>
                    )}
                    {inputModalities.includes('video') && (
                      <span className="model-modal-tag modality video">🎬 비디오</span>
                    )}
                    {inputModalities.includes('audio') && (
                      <span className="model-modal-tag modality audio">🎙️ 오디오</span>
                    )}
                    {!inputModalities.includes('image') &&
                      !inputModalities.includes('video') &&
                      !inputModalities.includes('audio') && (
                        <span className="model-modal-tag modality text">📝 텍스트 전용</span>
                      )}

                    <div
                      className="model-modal-tag date"
                      title={`출시일: ${model.createdDate ?? '미상'}`}
                    >
                      <Calendar size={12} />
                      <span>
                        {model.daysAgo == null
                          ? '출시일 미상'
                          : model.daysAgo === 0
                            ? '오늘 출시'
                            : `${model.daysAgo}일 전`}
                      </span>
                    </div>

                    {model.intelligenceTier && (
                      <div className="model-modal-tag tier">
                        <Brain size={12} />
                        <span>{model.intelligenceTier}</span>
                      </div>
                    )}

                    {model.parametersSummary && model.parametersSummary !== 'N/A' && (
                      <div className="model-modal-tag param">
                        <Cpu size={12} />
                        <span>{model.parametersSummary}</span>
                      </div>
                    )}

                    {model.contextLengthFormatted && (
                      <div className="model-modal-tag context">
                        <Layers size={12} />
                        <span>{model.contextLengthFormatted}</span>
                      </div>
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

        {/* 모달 하단 */}
        <div className="model-modal-footer">
          <div className="model-modal-footer-tip">
            <Zap size={14} color="#3182f6" />
            <span>
              가장 빠른 모델이 기본으로 선택돼요 · 속도/레이턴시는 Artificial Analysis 측정값
              기준(일부 추정)
            </span>
          </div>
          <button type="button" className="model-modal-confirm-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
