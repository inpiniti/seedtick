// src/components/studio/MobileSettingsModal.tsx - Modal for mobile studio settings (AI Model, Language, etc.)
import React, { useEffect } from 'react';
import {
  Settings,
  Sparkles,
  Globe,
  RotateCcw,
  Image as ImageIcon,
  ChevronRight,
  X,
  Zap,
  Scissors,
} from 'lucide-react';
import type { FreeModelMeta } from '../../types/gateway.ts';
import { cleanModelName, getSpeedTier } from '../../services/modelMetrics.ts';
import { useI18n } from '../../i18n/index.tsx';

export interface MobileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModelModal: () => void;
  onOpenLanguageModal: () => void;
  currentModel?: FreeModelMeta;
  isLoadingModels?: boolean;
  currentLocaleInfo: { flag: string; nativeName: string; name: string };
  hasVideos: boolean;
  onReset?: () => void;
  hasStitchedResult: boolean;
  onDownloadThumbnail?: () => void;
  onReStitch?: () => void;
  isReStitching?: boolean;
}

export const MobileSettingsModal: React.FC<MobileSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenModelModal,
  onOpenLanguageModal,
  currentModel,
  isLoadingModels,
  currentLocaleInfo,
  hasVideos,
  onReset,
  hasStitchedResult,
  onDownloadThumbnail,
  onReStitch,
  isReStitching,
}) => {
  const { dict } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentSpeedTier = currentModel ? getSpeedTier(currentModel.speedTokensPerSecond) : null;

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal-card settings-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <Settings size={22} color="#3182f6" />
            </div>
            <div className="model-modal-titles">
              <h2 id="settings-modal-title" className="model-modal-title">
                {dict.settingsModal?.title || dict.common.settings || '스튜디오 설정'}
              </h2>
              <p className="model-modal-subtitle">
                {dict.settingsModal?.subtitle || 'AI 모델 및 환경설정을 관리해요'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="settings-modal-body">
          {/* Group 1: AI Model */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              {dict.settingsModal?.aiEngine || 'AI Engine'}
            </span>
            <button
              type="button"
              className="settings-modal-item"
              onClick={() => {
                onClose();
                onOpenModelModal();
              }}
            >
              <div className="settings-modal-item-left">
                <div className="settings-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                  <Sparkles size={18} />
                </div>
                <div className="settings-modal-item-text">
                  <div className="settings-modal-item-title">{dict.header.aiModel}</div>
                  <div className="settings-modal-item-desc">
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>
                      {isLoadingModels
                        ? dict.header.loadingModels
                        : cleanModelName(currentModel?.name) || dict.header.selectModel}
                    </span>
                    {currentModel?.speedTokensPerSecond != null && currentSpeedTier && (
                      <span className={`toss-model-trigger-speed ${currentSpeedTier.key}`} style={{ fontSize: '10px' }}>
                        <Zap size={9} />
                        {Math.round(currentModel.speedTokensPerSecond)} tok/s
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="settings-modal-item-action">
                <span>{dict.common.edit || '변경'}</span>
                <ChevronRight size={15} color="#94a3b8" />
              </div>
            </button>
          </div>

          {/* Group 2: Language */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              {dict.settingsModal?.language || dict.common.language || 'Language'}
            </span>
            <button
              type="button"
              className="settings-modal-item"
              onClick={() => {
                onClose();
                onOpenLanguageModal();
              }}
            >
              <div className="settings-modal-item-left">
                <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                  <Globe size={18} />
                </div>
                <div className="settings-modal-item-text">
                  <div className="settings-modal-item-title">{dict.common.language || 'Language'}</div>
                  <div className="settings-modal-item-desc">
                    <span style={{ fontSize: '14px', lineHeight: 1 }}>{currentLocaleInfo.flag}</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{currentLocaleInfo.nativeName}</span>
                  </div>
                </div>
              </div>
              <div className="settings-modal-item-action">
                <span>{dict.common.edit || '변경'}</span>
                <ChevronRight size={15} color="#94a3b8" />
              </div>
            </button>
          </div>

          {/* Group 3: Project Actions */}
          {(hasStitchedResult || hasVideos) && (
            <div className="settings-modal-group">
              <span className="settings-modal-group-title">
                {dict.settingsModal?.projectActions || 'Project Actions'}
              </span>

              {hasStitchedResult && onReStitch && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onReStitch();
                  }}
                  disabled={isReStitching}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                      <Scissors size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title">
                        {dict.header.reStitch || '영상 다시 조합'}
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.settingsModal?.reStitchDesc || '수정된 타임라인으로 영상 다시 조합'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span>{isReStitching ? dict.header.stitching : (dict.common.retry || '조합')}</span>
                    <ChevronRight size={15} color="#94a3b8" />
                  </div>
                </button>
              )}

              {hasStitchedResult && onDownloadThumbnail && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onDownloadThumbnail();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                      <ImageIcon size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title">
                        {dict.thumbnail?.downloadBtn || dict.header.downloadThumbnail || '썸네일 다운로드'}
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.settingsModal?.thumbnailDesc || '16:9 AI 썸네일 아트워크 이미지 저장'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action">
                    <span>{dict.header.download || '다운로드'}</span>
                    <ChevronRight size={15} color="#94a3b8" />
                  </div>
                </button>
              )}

              {hasVideos && onReset && (
                <button
                  type="button"
                  className="settings-modal-item"
                  onClick={() => {
                    onClose();
                    onReset();
                  }}
                >
                  <div className="settings-modal-item-left">
                    <div className="settings-modal-icon-badge" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                      <RotateCcw size={18} />
                    </div>
                    <div className="settings-modal-item-text">
                      <div className="settings-modal-item-title" style={{ color: '#dc2626' }}>
                        {dict.header.reset || '새로 시작'}
                      </div>
                      <div className="settings-modal-item-desc">
                        {dict.settingsModal?.resetDesc || '업로드된 모든 영상 및 편집 타임라인 초기화'}
                      </div>
                    </div>
                  </div>
                  <div className="settings-modal-item-action" style={{ color: '#dc2626' }}>
                    <span>{dict.common.confirm || '초기화'}</span>
                    <ChevronRight size={15} color="#dc2626" />
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="model-modal-footer">
          <button
            type="button"
            className="toss-modal-btn-close"
            style={{ width: '100%' }}
            onClick={onClose}
          >
            {dict.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
