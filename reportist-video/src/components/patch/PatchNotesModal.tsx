// src/components/patch/PatchNotesModal.tsx - 독립 패치 노트 다이얼로그 (V1 호환용)
import React, { useEffect, useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { PatchNotesContent } from './PatchNotesContent.tsx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';
import { useI18n } from '../../i18n/index.tsx';

export interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ isOpen, onClose }) => {
  const { dict } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.toss-patch-modal-body, [data-modal-scrollable="true"]',
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
        className="model-modal-card toss-patch-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <div
          className="model-modal-header"
          style={{ borderBottom: '1px solid var(--ui-border)', paddingBottom: '16px' }}
        >
          <div className="model-modal-title-row">
            <div
              className="model-modal-icon-badge"
              style={{ backgroundColor: 'var(--ui-surface-muted)', color: 'var(--ui-ink)' }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="model-modal-title" id="patch-dialog-title" style={{ margin: 0 }}>
                {dict.patchNotes?.title || '패치 노트'}
              </h2>
              <p className="model-modal-subtitle">
                {dict.patchNotes?.subtitle ||
                  'PenguinCut의 모든 업데이트와 새로운 기능들을 모아봤어요.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common?.close || '닫기'}
          >
            <X size={20} />
          </button>
        </div>

        <PatchNotesContent onClose={onClose} />
      </div>
    </div>
  );
};

export default PatchNotesModal;
