// components/studio-v2/OnboardingCelebration.tsx
// 온보딩 완료 시 폭죽 연출 + 완료 안내. 폭죽 엔진은 공용 ConfettiCanvas를 재사용한다.
import { useEffect } from 'react';
import { PartyPopper } from 'lucide-react';
import { useI18n } from '../../i18n/index.tsx';
import { ConfettiCanvas } from '../common/ConfettiCanvas.tsx';

interface OnboardingCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
}

const AUTO_CLOSE_MS = 4200;

export const OnboardingCelebration = ({ isOpen, onClose }: OnboardingCelebrationProps) => {
  const { ui } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const closeTimer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(closeTimer);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="sv2-celebration" role="dialog" aria-modal="true" aria-live="polite">
      <ConfettiCanvas active className="sv2-celebration-canvas" />
      <div className="sv2-celebration-card">
        <div className="sv2-celebration-icon">
          <PartyPopper size={26} />
        </div>
        <h2>{ui('가이드를 마쳤어요. 이제 직접 만들어보세요!')}</h2>
        <p>{ui('튜토리얼을 따라 영상 하나를 완성했어요.')}</p>
        <button type="button" className="sv2-btn sv2-btn-primary" onClick={onClose}>
          {ui('확인')}
        </button>
      </div>
    </div>
  );
};
