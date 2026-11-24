// MobileBottomCtaBar.tsx - 모바일 화면 하단 고정 CTA 바
// 엄지가 닿는 자리에 [이전] + [다음: ○○ →] (마지막엔 [영상 저장하기]) 버튼 하나만 강하게 노출한다.
// Safe Area(iOS 홈 인디케이터)를 반영하고, 화면 하단을 가리지 않도록 본문에는 여백이 생긴다.
// 버튼 높이·폰트·radius는 공통 Button 프리미티브(uiTokens)만 사용해 좌우 버튼을 같은 36px로 맞춘다.
import React from 'react';
import { ArrowRight, ChevronLeft, Download } from 'lucide-react';
import { Button } from '../../ui/Button.tsx';
import { Tooltip } from '../../ui/Tooltip.tsx';

interface MobileBottomCtaBarProps {
  ariaLabel: string;
  prevLabel: string;
  onPrev: () => void;
  prevDisabled: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  isDownloadStep: boolean;
  /** 첫 단계에서는 이전 버튼을 비활성화가 아니라 아예 렌더하지 않는다 */
  isFirstStep: boolean;
  /** 마지막(다운로드) 단계에서는 다음/저장 버튼을 아예 렌더하지 않는다 */
  isLastStep: boolean;
  /** 회색으로 표시하되 클릭은 허용한다 — 누르면 차단 사유 토스트를 띄우는 패턴 */
  primaryBlocked?: boolean;
  primaryTitle?: string;
  /** 사용 가이드가 다음 단계 CTA를 짚을 때 쓰는 data-tour 셀렉터 값 */
  primaryDataTour?: string;
}

export const MobileBottomCtaBar: React.FC<MobileBottomCtaBarProps> = ({
  ariaLabel,
  prevLabel,
  onPrev,
  prevDisabled,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryBusy = false,
  isDownloadStep,
  isFirstStep,
  isLastStep,
  primaryBlocked = false,
  primaryTitle,
  primaryDataTour,
}) => {
  return (
    <nav className="toss-bottom-cta-bar" aria-label={ariaLabel}>
      {!isFirstStep && (
        <Button
          className="toss-bottom-cta-prev"
          variant="subtle"
          size="md"
          onClick={onPrev}
          disabled={prevDisabled}
          leftIcon={<ChevronLeft size={16} aria-hidden="true" />}
        >
          {prevLabel}
        </Button>
      )}

      {!isLastStep && (
        <Tooltip content={primaryTitle}>
          <Button
            data-tour={primaryDataTour}
            className={`toss-bottom-cta-primary${primaryBlocked ? ' is-blocked' : ''}`}
            variant="accent"
            size="md"
            onClick={onPrimary}
            disabled={primaryDisabled}
            aria-disabled={primaryBlocked || undefined}
            loading={primaryBusy}
            rightIcon={
              isDownloadStep ? (
                <Download size={16} aria-hidden="true" />
              ) : (
                <ArrowRight size={16} aria-hidden="true" />
              )
            }
          >
            {primaryLabel}
          </Button>
        </Tooltip>
      )}
    </nav>
  );
};
