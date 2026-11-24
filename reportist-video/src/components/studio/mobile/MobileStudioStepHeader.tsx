// MobileStudioStepHeader.tsx - 모바일 전용 컴팩트 스텝 헤더
// 가로로 잘리던 7~8단계 카드 스트립 대신 "지금 단계(n/N) + 한 줄 상태 + 얇은 진행률 바"만 보여주고,
// 탭하면 MobileStepListSheet가 전체 단계 목록을 띄운다.
import React from 'react';
import { ChevronDown, CircleHelp } from 'lucide-react';
import { StudioStepIcon } from '../StudioStepIcon.tsx';
import { Tooltip } from '../../ui/Tooltip.tsx';

interface MobileStudioStepHeaderProps {
  stepIndex: number;
  totalSteps: number;
  stepId: string;
  stepLabel: string;
  stepStatus: string;
  stepPositionLabel: string;
  viewAllLabel: string;
  openAllAriaLabel: string;
  onOpenAll: () => void;
  /** 사용 가이드(투어) 열기 — 전달하지 않으면 버튼을 렌더하지 않는다. */
  onOpenGuide?: () => void;
  guideAriaLabel?: string;
}

export const MobileStudioStepHeader: React.FC<MobileStudioStepHeaderProps> = ({
  stepIndex,
  totalSteps,
  stepId,
  stepLabel,
  stepStatus,
  stepPositionLabel,
  viewAllLabel,
  openAllAriaLabel,
  onOpenAll,
  onOpenGuide,
  guideAriaLabel,
}) => {
  const progressPercent = Math.min(100, Math.max(0, ((stepIndex + 1) / totalSteps) * 100));

  return (
    <div className="toss-mobile-step-header" data-tour="studio-step-header">
      <div className="toss-mobile-step-header-row">
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
          <span className="toss-mobile-step-label">
            <span className="toss-mobile-step-label-icon" aria-hidden="true">
              <StudioStepIcon stepId={stepId} size={14} />
            </span>
            {stepLabel}
          </span>
          <span className="toss-mobile-step-status">{stepStatus}</span>
        </span>
        <span className="toss-mobile-step-viewall">
          <span>{viewAllLabel}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </button>
      {onOpenGuide && (
        <Tooltip content={guideAriaLabel}>
          <button
            type="button"
            className="toss-mobile-step-guide-btn"
            data-tour="studio-guide-trigger"
            onClick={onOpenGuide}
            aria-label={guideAriaLabel}
          >
            <CircleHelp size={18} aria-hidden="true" />
          </button>
        </Tooltip>
      )}
      </div>
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
