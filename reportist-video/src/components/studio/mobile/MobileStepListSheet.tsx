// MobileStepListSheet.tsx - 모바일 전용 "전체 단계" 바텀시트
// 상단 스텝 헤더(n/N · 현재 단계)를 탭하면 화면 아래에서 올라와
// 1~8(7)번 모든 단계의 상태를 세로 리스트로 한 번에 보여준다.
import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { StudioStepIcon } from '../StudioStepIcon.tsx';

export interface MobileStepListItem {
  id: string;
  index: number;
  label: string;
  status: string;
  isActive: boolean;
}

interface MobileStepListSheetProps {
  isOpen: boolean;
  onClose: () => void;
  steps: MobileStepListItem[];
  title: string;
  closeLabel: string;
  onSelect: (id: string) => void;
}

export const MobileStepListSheet: React.FC<MobileStepListSheetProps> = ({
  isOpen,
  onClose,
  steps,
  title,
  closeLabel,
  onSelect,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="toss-step-sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="toss-step-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="toss-step-sheet-grabber" aria-hidden="true" />

        <div className="toss-step-sheet-head">
          <div className="toss-step-sheet-head-text">
            <strong className="toss-step-sheet-title">{title}</strong>
          </div>
          <button
            type="button"
            className="toss-step-sheet-close"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X size={18} />
          </button>
        </div>

        <ol className="toss-step-sheet-list">
          {steps.map((step) => (
            <li key={step.id} className="toss-step-sheet-item">
              <button
                type="button"
                className={`toss-step-sheet-row ${step.isActive ? 'active' : ''}`}
                aria-current={step.isActive ? 'step' : undefined}
                onClick={() => {
                  onSelect(step.id);
                  onClose();
                }}
              >
                <span className="toss-step-sheet-index" aria-hidden="true">
                  {step.index + 1}
                </span>
                <span className="toss-step-sheet-text">
                  <span className="toss-step-sheet-label">
                    <span className="toss-step-sheet-label-icon" aria-hidden="true">
                      <StudioStepIcon stepId={step.id} size={14} />
                    </span>
                    {step.label}
                  </span>
                  <span className="toss-step-sheet-status">{step.status}</span>
                </span>
                {step.isActive && (
                  <Check size={18} className="toss-step-sheet-check" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
