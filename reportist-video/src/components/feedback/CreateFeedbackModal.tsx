// src/components/feedback/CreateFeedbackModal.tsx - Modal for submitting user feedback & bug reports
import React from 'react';
import type { NewFeedbackInput } from '../../types/feedback.ts';
import { CreateFeedbackForm } from './CreateFeedbackForm.tsx';

interface CreateFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewFeedbackInput) => Promise<void>;
}

export const CreateFeedbackModal: React.FC<CreateFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="toss-modal-backdrop" onClick={onClose}>
      <div
        className="toss-modal-container toss-feedback-modal max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 overflow-y-auto">
          <CreateFeedbackForm
            onCancel={onClose}
            onSubmit={async (data) => {
              await onSubmit(data);
              onClose();
            }}
            showBackHeader={true}
          />
        </div>
      </div>
    </div>
  );
};
