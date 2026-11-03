// src/components/studio/DateFormatSelectorModal.tsx - Modal for selecting filming date format (Toss modal style)
import React, { useEffect, useMemo } from 'react';
import { Calendar, X, Check, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n/index.tsx';
import {
  getDateFormats,
  type DateFormatOption,
} from '../../services/videoMetadata.ts';

export interface DateFormatSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFormat: DateFormatOption;
  onSelectFormat: (format: DateFormatOption) => void;
  referenceDate?: Date;
}

export const DateFormatSelectorModal: React.FC<DateFormatSelectorModalProps> = ({
  isOpen,
  onClose,
  currentFormat,
  onSelectFormat,
  referenceDate,
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

  const formats = useMemo(() => {
    return getDateFormats(referenceDate || new Date());
  }, [referenceDate]);

  if (!isOpen) return null;

  const handleSelect = (formatId: DateFormatOption) => {
    onSelectFormat(formatId);
    onClose();
  };

  const modalTitle = dict.dateFormatModal?.title || dict.settingsModal?.dateFormat || '촬영 날짜 표기 형식';
  const modalSubtitle =
    dict.dateFormatModal?.subtitle || '영상 자막과 클립 정보에 표시될 날짜 형태를 선택하세요.';
  const defaultBadgeText = dict.dateFormatModal?.defaultBadge || '권장 기본값';
  const tipText =
    dict.dateFormatModal?.tip ||
    '선택하신 날짜 포맷은 브라우저에 저장되며, 모든 영상 자막 및 편집 타임라인에 실시간 적용됩니다.';

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal-card language-modal-card date-format-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="date-format-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#3182f6' }}>
              <Calendar size={22} color="#3182f6" />
            </div>
            <div>
              <h2 className="model-modal-title" id="date-format-modal-title">
                {modalTitle}
              </h2>
              <p className="model-modal-subtitle">{modalSubtitle}</p>
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

        {/* Format List */}
        <div className="model-modal-list language-modal-list" style={{ maxHeight: '380px' }}>
          {formats.map((fmt) => {
            const isSelected = fmt.id === currentFormat;
            return (
              <div
                key={fmt.id}
                className={`language-modal-item ${isSelected ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(fmt.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(fmt.id);
                  }
                }}
              >
                <div className="language-modal-item-left">
                  <div
                    className="language-modal-flag-badge"
                    style={{
                      width: '38px',
                      height: '38px',
                      backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                      color: isSelected ? '#2563eb' : '#64748b',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Calendar size={18} />
                  </div>
                  <div className="language-modal-item-text">
                    <div className="language-modal-item-native-row">
                      <span
                        className="language-modal-item-native"
                        style={{ fontFamily: 'monospace', letterSpacing: '-0.3px', fontWeight: 700 }}
                      >
                        {fmt.example}
                      </span>
                      {fmt.isDefault && (
                        <span className="language-modal-badge default" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                          <Sparkles size={11} style={{ display: 'inline', marginRight: '3px' }} />
                          {defaultBadgeText}
                        </span>
                      )}
                    </div>
                    <span className="language-modal-item-english" style={{ fontSize: '12px', color: '#64748b' }}>
                      {fmt.label} ({fmt.formatName})
                    </span>
                  </div>
                </div>

                <div className="language-modal-item-right">
                  <div
                    className={`model-modal-check-badge ${
                      isSelected ? 'selected' : 'unselected'
                    }`}
                  >
                    {isSelected && <Check size={16} color="#ffffff" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer / Tip */}
        <div className="model-modal-footer">
          <p className="model-modal-footer-tip" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💡</span>
            <span>{tipText}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DateFormatSelectorModal;
