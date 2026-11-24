// components/studio-v2/OnboardingWelcomeModal.tsx
// 첫 실행 시 "가이드를 볼지" 묻는 팝업. 언제든 "나중에"로 닫을 수 있다.
import { useEffect, useRef } from 'react';
import { ArrowRight, Play, Sparkles, X } from 'lucide-react';
import { useI18n } from '../../i18n/index.tsx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';

interface OnboardingWelcomeModalProps {
  isOpen: boolean;
  onStart: () => void;
  onDismiss: () => void;
}

const PREVIEW_STEPS = [
  '샘플 영상 넣기',
  'AI로 장면 고르기',
  '타임라인 · 자막 수정',
  'MP4 다운로드',
] as const;

export const OnboardingWelcomeModal = ({
  isOpen,
  onStart,
  onDismiss,
}: OnboardingWelcomeModalProps) => {
  const { ui } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  useModalScrollLock(isOpen, { overlayRef });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="model-modal-backdrop sv2-onboarding-backdrop"
      onClick={onDismiss}
    >
      <div
        className="model-modal-card sv2-onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sv2-onboarding-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="model-modal-close-btn"
          onClick={onDismiss}
          aria-label={ui('닫기')}
        >
          <X size={18} />
        </button>

        <div className="sv2-onboarding-hero">
          <div className="sv2-onboarding-icon">
            <Sparkles size={26} />
          </div>
          <h2 id="sv2-onboarding-title">{ui('펭귄컷, 1분이면 충분해요')}</h2>
          <p>{ui('샘플 영상으로 업로드부터 다운로드까지 같이 해볼게요.')}</p>
        </div>

        <ol className="sv2-onboarding-steps">
          {PREVIEW_STEPS.map((label, index) => (
            <li key={label}>
              <span className="sv2-onboarding-step-no">{index + 1}</span>
              <span>{ui(label)}</span>
              {index < PREVIEW_STEPS.length - 1 && <ArrowRight size={13} aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <div className="sv2-onboarding-actions">
          <button type="button" className="sv2-btn sv2-btn-ghost" onClick={onDismiss}>
            {ui('나중에')}
          </button>
          <button type="button" className="sv2-btn sv2-btn-primary" onClick={onStart}>
            <Play size={15} fill="currentColor" /> {ui('샘플로 시작하기')}
          </button>
        </div>
      </div>
    </div>
  );
};
