// components/studio/ModelSelectorModal.tsx - AI Vision Model Selector Modal with i18n

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
  cleanModelName,
  compareModelsByIntelligence,
  getSpeedTier,
  pickDefaultModel,
} from '../../services/modelMetrics.ts';
import { useI18n } from '../../i18n/index.tsx';
import {
  localizeIntelligenceTier,
  localizeParametersSummary,
  localizeContextLength,
} from '../../i18n/modelLocalization.ts';

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
  const { dict, interpolate, locale } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedModality, setSelectedModality] = useState<ModalityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('intelligence');

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
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <Sparkles size={20} color="#3182f6" />
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
        <div className="model-modal-list">
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
                        <span>{model.speedTokensPerSecond != null ? dict.modelModal.speedUnit : '—'}</span>
                      </div>
                    </div>

                    <div className="model-modal-metric latency">
                      <div className="model-modal-metric-label">
                        <Timer size={12} />
                        <span>{dict.modelModal.metricTtft}</span>
                      </div>
                      <div className="model-modal-metric-value">
                        <strong>{formatLatency(model.latencyMs)}</strong>
                        <span>{model.latencyMs != null ? dict.modelModal.ttftUnit : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Speed bar */}
                  {model.speedTokensPerSecond != null && (
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
                  </div>

                  {model.description && (
                    <p className="model-modal-desc">{model.description}</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="model-modal-footer">
          <div className="model-modal-footer-tip">
            <Sparkles size={14} color="#3182f6" />
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
