// MobileBottomCtaBar.tsx - 모바일 화면 하단 고정 CTA 바
// 엄지가 닿는 자리에 [이전] + [다음: ○○ →] (마지막엔 [영상 저장하기]) 버튼 하나만 강하게 노출한다.
// Safe Area(iOS 홈 인디케이터)를 반영하고, 화면 하단을 가리지 않도록 본문에는 여백이 생긴다.
import React from 'react';
import { ArrowRight, ChevronLeft, Download } from 'lucide-react';

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
      <button
        type="button"
        className="toss-bottom-cta-prev"
        onClick={onPrev}
        disabled={prevDisabled}
      >
        <ChevronLeft size={18} aria-hidden="true" />
        <span>{prevLabel}</span>
      </button>

      <button
        type="button"
        className={`toss-bottom-cta-primary ${primaryBusy ? 'is-busy' : ''}`}
        onClick={onPrimary}
        disabled={primaryDisabled}
        aria-busy={primaryBusy}
      >
        <span className="toss-bottom-cta-primary-label">{primaryLabel}</span>
        {isDownloadStep ? (
          <Download size={17} className={primaryBusy ? 'animate-bounce' : ''} aria-hidden="true" />
        ) : (
          <ArrowRight size={18} aria-hidden="true" />
        )}
      </button>
    </nav>
  );
};
