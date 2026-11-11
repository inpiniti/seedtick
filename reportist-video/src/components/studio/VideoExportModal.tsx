import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  X,
  Clock,
  Film,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { ExportResolution } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';

export interface VideoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentResolution: ExportResolution;
  onConfirmDownload: (res: ExportResolution) => void;
  totalDurationText: string;
  segmentCount: number;
  isMobileDevice: boolean;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  isOpen,
  onClose,
  currentResolution,
  onConfirmDownload,
  totalDurationText,
  segmentCount,
  isMobileDevice,
}) => {
  const { dict, interpolate } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selectedRes, setSelectedRes] = useState<ExportResolution>(currentResolution);

  // Sync with currentResolution whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRes(currentResolution);
    }
  }, [isOpen, currentResolution]);

  // Lock scroll
  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.export-modal-body, [data-modal-scrollable="true"]',
  });

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirmDownload(selectedRes);
    onClose();
  };

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
        className="model-modal-card export-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge" style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
              <Download size={22} />
            </div>
            <div className="model-modal-titles">
              <h2 id="export-modal-title" className="model-modal-title">
                {dict.header.download || '완성 영상 다운로드'}
              </h2>
              <p className="model-modal-subtitle">
                {dict.exportSettings?.cardDesc || '원하는 해상도와 품질을 선택하고 영상을 내보내요'}
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

        {/* Body */}
        <div
          className="model-modal-body export-modal-body"
          data-modal-scrollable="true"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Summary Meta Bar */}
          <div className="export-modal-meta-box">
            <div className="export-modal-meta-item">
              <Clock size={14} className="text-blue-500" />
              <span className="export-modal-meta-label">{dict.exportSettings?.totalDurationLabel || '총 길이:'}</span>
              <strong className="export-modal-meta-val">{totalDurationText}</strong>
            </div>
            <span className="export-modal-meta-dot">·</span>
            <div className="export-modal-meta-item">
              <Film size={14} className="text-blue-500" />
              <span className="export-modal-meta-label">{dict.exportSettings?.highlightsLabel || '하이라이트:'}</span>
              <strong className="export-modal-meta-val">
                {interpolate(dict.exportSettings?.segmentCount || '{count}개 클립', { count: segmentCount })}
              </strong>
            </div>
          </div>

          {/* Resolution Options */}
          <div className="settings-modal-group">
            <span className="settings-modal-group-title">
              {dict.settingsModal?.resolutionSection || '내보내기 영상 화질 (해상도)'}
            </span>
            <div className="toss-modal-res-list" role="radiogroup" aria-label="Export Resolution">
              {/* 720p HD */}
              <button
                type="button"
                role="radio"
                aria-checked={selectedRes === '720p'}
                onClick={() => setSelectedRes('720p')}
                className={`toss-modal-res-item ${selectedRes === '720p' ? 'active' : ''}`}
              >
                <div className="toss-modal-res-item-left">
                  <div className="toss-modal-res-radio">
                    {selectedRes === '720p' && <div className="toss-modal-res-radio-dot" />}
                  </div>
                  <div className="toss-modal-res-content">
                    <div className="toss-modal-res-title-row">
                      <span className="toss-modal-res-title">720p HD</span>
                      <span className="toss-modal-res-subbadge standard">
                        {dict.exportSettings?.standardBadge || '기본'}
                      </span>
                    </div>
                    <div className="toss-modal-res-desc">
                      {dict.settingsModal?.resolution720pDesc || '인코딩이 빠르고 모든 기기에서 안정적이에요'}
                    </div>
                  </div>
                </div>
              </button>

              {/* 1080p FHD */}
              <button
                type="button"
                role="radio"
                aria-checked={selectedRes === '1080p'}
                onClick={() => setSelectedRes('1080p')}
                className={`toss-modal-res-item ${selectedRes === '1080p' ? 'active' : ''}`}
              >
                <div className="toss-modal-res-item-left">
                  <div className="toss-modal-res-radio">
                    {selectedRes === '1080p' && <div className="toss-modal-res-radio-dot" />}
                  </div>
                  <div className="toss-modal-res-content">
                    <div className="toss-modal-res-title-row">
                      <span className="toss-modal-res-title">1080p FHD</span>
                      <span className="toss-modal-res-subbadge desktop">
                        {dict.settingsModal?.resolutionDesktopBadge || '데스크탑 권장'}
                      </span>
                    </div>
                    <div className="toss-modal-res-desc">
                      {dict.settingsModal?.resolution1080pDesc || '더 선명하고 또렷한 고해상도로 내보내요'}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* 모바일 1080p 선택 시 경고 안내 */}
            {selectedRes === '1080p' && isMobileDevice && (
              <div className="toss-modal-res-warning">
                <AlertTriangle size={15} className="toss-modal-res-warning-icon" />
                <span className="toss-modal-res-warning-text">
                  {dict.settingsModal?.resolutionMobileWarning ||
                    dict.exportSettings?.mobileWarning ||
                    '모바일 기기에서는 영상 길이에 따라 브라우저 메모리 부족으로 튕길 수 있어요.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="model-modal-footer export-modal-footer">
          <button
            type="button"
            className="export-modal-cancel-btn"
            onClick={onClose}
          >
            {dict.common.close || '닫기'}
          </button>
          <button
            type="button"
            className="model-modal-confirm-btn export-modal-confirm-btn"
            onClick={handleConfirm}
          >
            <Download size={14} style={{ marginRight: 6 }} />
            <span>
              {interpolate(dict.exportSettings?.downloadRes || '{res} 다운로드', { res: selectedRes })}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
