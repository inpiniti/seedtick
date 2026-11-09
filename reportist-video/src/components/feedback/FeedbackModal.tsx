// src/components/feedback/FeedbackModal.tsx - Full Feedback & Roadmap Dialog Modal
import React, { useEffect, useRef } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { FeedbackView } from './FeedbackView.tsx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.toss-feedback-modal-body, [data-modal-scrollable="true"]',
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
        className="model-modal-card toss-feedback-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="model-modal-header" style={{ borderBottom: '1px solid #eef2f6', paddingBottom: '14px' }}>
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="model-modal-title" id="feedback-dialog-title">
                피드백 & 개선 요청
              </h2>
              <p className="model-modal-subtitle">
                불편사항이나 필요한 기능을 남겨주시면 개발자가 직접 확인하고 처리 결과를 공유합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body containing the FeedbackView */}
        <div
          className="toss-feedback-modal-body"
          data-modal-scrollable="true"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <FeedbackView isEmbedded />
        </div>
      </div>
    </div>
  );
};
