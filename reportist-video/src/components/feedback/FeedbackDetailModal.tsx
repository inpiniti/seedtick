// src/components/feedback/FeedbackDetailModal.tsx - Modal for viewing feedback details and developer response
import React, { useRef } from 'react';
import type { FeedbackItem, FeedbackStatus } from '../../types/feedback.ts';
import { FeedbackDetailView } from './FeedbackDetailView.tsx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';

interface FeedbackDetailModalProps {
  feedback: FeedbackItem | null;
  isOpen: boolean;
  onClose: () => void;
  onLike: (id: string) => void;
  isAdminMode: boolean;
  onUpdateStatusAndResponse: (
    id: string,
    status: FeedbackStatus,
    adminResponse: string | null
  ) => Promise<void>;
  onDeleteFeedback: (id: string) => Promise<void>;
}

export const FeedbackDetailModal: React.FC<FeedbackDetailModalProps> = ({
  feedback,
  isOpen,
  onClose,
  onLike,
  isAdminMode,
  onUpdateStatusAndResponse,
  onDeleteFeedback,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalScrollLock(isOpen && !!feedback, {
    overlayRef,
    scrollableSelector: '[data-modal-scrollable="true"]',
  });

  if (!isOpen || !feedback) return null;

  return (
    <div ref={overlayRef} className="toss-modal-backdrop" onClick={onClose}>
      <div
        className="toss-modal-container toss-feedback-detail-modal max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 overflow-y-auto min-h-0" data-modal-scrollable="true">
          <FeedbackDetailView
            feedback={feedback}
            onBack={onClose}
            onLike={onLike}
            isAdminMode={isAdminMode}
            onUpdateStatusAndResponse={onUpdateStatusAndResponse}
            onDeleteFeedback={onDeleteFeedback}
          />
        </div>
      </div>
    </div>
  );
};
