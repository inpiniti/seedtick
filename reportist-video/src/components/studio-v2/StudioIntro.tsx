// components/studio-v2/StudioIntro.tsx — 스튜디오 첫 진입 연출.
// 상단바에 원래 박혀 있는 브랜드 요소 자체를 중앙으로 보내 로고를 그린 뒤,
// transform만 되돌려 제자리로 앉힌다. 복제·교체가 없어 최종 상태가 100% 동일하다.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './studioIntro.css';

export type StudioIntroPhase = 'intro' | 'flying' | 'revealing' | 'pinned' | 'done';

const DRAW_MS = 1400;
const FLY_MS = 820;
const HAND_OFF_MS = 120;
const REVEAL_MS = 2100;
// 중앙에서 그려질 때의 확대 배율(상단바 로고 ≈26px → ≈83px).
const INTRO_SCALE = 3.2;

/**
 * 인트로를 건너뛸지 판단한다.
 * 새로고침·재방문에도 매번 재생하고, 모션 감소 설정 또는 ?intro=0 에서만 생략한다.
 */
export function shouldSkipStudioIntro(): boolean {
  if (typeof window === 'undefined') return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('intro') === '0') return true;
  if (params.get('intro') === '1') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

interface StudioIntroProps {
  initialPhase: StudioIntroPhase;
  onPhaseChange: (phase: StudioIntroPhase) => void;
}

export function StudioIntro({ initialPhase, onPhaseChange }: StudioIntroProps) {
  const [phase, setPhase] = useState<StudioIntroPhase>(initialPhase);
  const brandRef = useRef<HTMLElement | null>(null);

  // 부모의 루트 data-intro 속성과 내부 위상을 항상 동기화한다.
  useEffect(() => {
    onPhaseChange(phase);
  }, [phase, onPhaseChange]);

  // 첫 페인트 전에 실제 상단바 브랜드를 중앙·확대 위치로 옮긴다.
  useLayoutEffect(() => {
    if (phase !== 'intro') return;
    const brand = document.querySelector<HTMLElement>('.sv2-brand');
    if (!brand) return;
    brandRef.current = brand;

    const r = brand.getBoundingClientRect();
    const dx = window.innerWidth / 2 - (r.left + r.width / 2);
    const dy = window.innerHeight / 2 - (r.top + r.height / 2);

    brand.style.transition = 'none';
    brand.style.transform = `translate(${dx}px, ${dy}px) scale(${INTRO_SCALE})`;
    void brand.offsetWidth;
  }, [phase]);

  useEffect(() => {
    if (phase === 'intro') {
      const timer = window.setTimeout(() => setPhase('flying'), DRAW_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'flying') {
      // 같은 요소가 원래 레이아웃 위치로 돌아간다. 교체가 없으므로 픽셀 오차가 없다.
      const brand = brandRef.current;
      if (brand) {
        brand.style.transition = `transform ${FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        brand.style.transform = 'none';
      }
      const timer = window.setTimeout(() => setPhase('revealing'), FLY_MS + HAND_OFF_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'revealing') {
      const timer = window.setTimeout(() => setPhase('pinned'), REVEAL_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'pinned') {
      const timer = window.setTimeout(() => setPhase('done'), 120);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'done') {
      const brand = brandRef.current;
      if (brand) {
        brand.style.transition = '';
        brand.style.transform = '';
      }
    }

    return;
  }, [phase]);

  if (phase === 'done') return null;

  const showBackdrop = phase === 'intro' || phase === 'flying' || phase === 'revealing';

  return createPortal(
    showBackdrop ? (
      <div className="sv2-intro-backdrop" data-phase={phase} aria-hidden="true">
        <div className="sv2-intro-glow" />
      </div>
    ) : null,
    document.body
  );
}
