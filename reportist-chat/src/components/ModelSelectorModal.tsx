// components/ModelSelectorModal.tsx - 모델 선택 팝업/바텀시트

import React, { useMemo, useState } from 'react';
import {
  Brain,
  Calendar,
  Check,
  Cpu,
  Layers,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import type { FreeModelMeta } from '../types/chat.ts';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: FreeModelMeta[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
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

  // 제공사 목록 추출
  const providers = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => {
      set.add(m.providerName);
    });
    return Array.from(set);
  }, [models]);

  // 필터링된 모델 목록
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchQuery =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.intelligenceTier.toLowerCase().includes(searchQuery.toLowerCase());

      const matchProvider =
        selectedProvider === 'all' || m.providerName === selectedProvider;

      return matchQuery && matchProvider;
    });
  }, [models, searchQuery, selectedProvider]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* 모달 헤더 */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge">
              <Sparkles size={20} color="#3182f6" />
            </div>
            <div>
              <h2 className="modal-title">AI 모델 선택하기</h2>
              <p className="modal-subtitle">
                OpenRouter에서 제공하는 총 {models.length}개의 최신 무료 텍스트 모델이에요
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 검색 및 필터 */}
        <div className="modal-search-section">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="모델명, 제조사, 특징으로 검색해 보세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 제조사 필터 칩 */}
          <div className="provider-chips-container">
            <button
              type="button"
              className={`provider-chip ${selectedProvider === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedProvider('all')}
            >
              전체 ({models.length})
            </button>
            {providers.map((p) => {
              const count = models.filter((m) => m.providerName === p).length;
              return (
                <button
                  key={p}
                  type="button"
                  className={`provider-chip ${selectedProvider === p ? 'active' : ''}`}
                  onClick={() => setSelectedProvider(p)}
                >
                  {p} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* 모델 카드 리스트 */}
        <div className="model-list-scroll">
          {filteredModels.length === 0 ? (
            <div className="empty-models">
              <Brain size={36} color="#8b95a1" />
              <p className="empty-title">일치하는 모델이 없어요</p>
              <p className="empty-desc">검색어나 제공사 필터를 다시 확인해 주세요</p>
            </div>
          ) : (
            filteredModels.map((model) => {
              const isSelected = model.id === selectedModelId;
              const isNew = model.daysAgo <= 14;

              return (
                <div
                  key={model.id}
                  className={`model-card-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectModel(model.id);
                    onClose();
                  }}
                >
                  <div className="model-card-top">
                    <div className="model-name-group">
                      <span className="model-provider-badge">{model.providerName}</span>
                      <h3 className="model-name-text">{model.name}</h3>
                      {isNew && <span className="new-badge">NEW</span>}
                    </div>

                    <div className="model-select-indicator">
                      {isSelected ? (
                        <div className="check-badge selected">
                          <Check size={16} color="#ffffff" />
                        </div>
                      ) : (
                        <div className="check-badge unselected" />
                      )}
                    </div>
                  </div>

                  {/* 모델 특징 메타 태그들 */}
                  <div className="model-tags-row">
                    {/* 출시일 정보 */}
                    <div className="meta-pill date-pill" title={`출시일: ${model.createdDate}`}>
                      <Calendar size={13} className="meta-icon" />
                      <span>{model.daysAgo === 0 ? '오늘 출시' : `${model.daysAgo}일 전`}</span>
                    </div>

                    {/* 지능 및 아키텍처 */}
                    <div className="meta-pill tier-pill">
                      <Brain size={13} className="meta-icon" />
                      <span>{model.intelligenceTier}</span>
                    </div>

                    {/* 파라미터 정보 */}
                    {model.parametersSummary !== 'N/A' && (
                      <div className="meta-pill param-pill">
                        <Cpu size={13} className="meta-icon" />
                        <span>{model.parametersSummary}</span>
                      </div>
                    )}

                    {/* 컨텍스트 길이 */}
                    <div className="meta-pill ctx-pill">
                      <Layers size={13} className="meta-icon" />
                      <span>{model.contextLengthFormatted}</span>
                    </div>
                  </div>

                  {/* 설명 */}
                  <p className="model-desc-text">{model.description}</p>
                </div>
              );
            })
          )}
        </div>

        {/* 모달 하단 */}
        <div className="modal-footer">
          <div className="modal-footer-tip">
            <Zap size={14} color="#3182f6" />
            <span>모든 모델은 무료(:free)로 토큰 과금 없이 이용할 수 있어요</span>
          </div>
          <button type="button" className="modal-confirm-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
