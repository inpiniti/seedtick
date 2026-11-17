// MobileStudioStepHeader.tsx - 모바일 전용 컴팩트 스텝 헤더
// 가로로 잘리던 7~8단계 카드 스트립 대신 "지금 단계(n/N) + 한 줄 상태 + 얇은 진행률 바"만 보여주고,
// 탭하면 MobileStepListSheet가 전체 단계 목록을 띄운다.
import React from 'react';
import { ChevronDown } from 'lucide-react';

interface MobileStudioStepHeaderProps {
  stepIndex: number;
  totalSteps: number;
  stepLabel: string;
  stepStatus: string;
  stepPositionLabel: string;
  viewAllLabel: string;
  openAllAriaLabel: string;
  onOpenAll: () => void;
}

export const MobileStudioStepHeader: React.FC<MobileStudioStepHeaderProps> = ({
  stepIndex,
  totalSteps,
  stepLabel,
  stepStatus,
  stepPositionLabel,
  viewAllLabel,
  openAllAriaLabel,
  onOpenAll,
}) => {
  const progressPercent = Math.min(100, Math.max(0, ((stepIndex + 1) / totalSteps) * 100));

  return (
    <div className="toss-mobile-step-header">
      <button
        type="button"
        className="toss-mobile-step-header-btn"
        onClick={onOpenAll}
        aria-label={openAllAriaLabel}
        aria-haspopup="dialog"
      >
        <span className="toss-mobile-step-count" aria-hidden="true">
          {stepPositionLabel}
        </span>
        <span className="toss-mobile-step-body">
          <span className="toss-mobile-step-label">{stepLabel}</span>
          <span className="toss-mobile-step-status">{stepStatus}</span>
        </span>
        <span className="toss-mobile-step-viewall">
          <span>{viewAllLabel}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </button>
      <div
        className="toss-mobile-step-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        aria-label={stepLabel}
      >
        <div
          className="toss-mobile-step-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
