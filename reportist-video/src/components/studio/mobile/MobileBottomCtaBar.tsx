// MobileBottomCtaBar.tsx - 모바일 화면 하단 고정 CTA 바
// 엄지가 닿는 자리에 [이전] + [다음: ○○ →] (마지막엔 [영상 저장하기]) 버튼 하나만 강하게 노출한다.
// Safe Area(iOS 홈 인디케이터)를 반영하고, 화면 하단을 가리지 않도록 본문에는 여백이 생긴다.
// 버튼 높이·폰트·radius는 공통 Button 프리미티브(uiTokens)만 사용해 좌우 버튼을 같은 36px로 맞춘다.
import React from 'react';
import { ArrowRight, ChevronLeft, Download } from 'lucide-react';
import { Button } from '../../ui/Button.tsx';

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
}) => {
  return (
    <nav className="toss-bottom-cta-bar" aria-label={ariaLabel}>
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

      <Button
        className="toss-bottom-cta-primary"
        variant="accent"
        size="md"
        onClick={onPrimary}
        disabled={primaryDisabled}
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
    </nav>
  );
};
