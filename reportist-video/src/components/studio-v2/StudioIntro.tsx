// components/studio-v2/StudioIntro.tsx — 스튜디오 첫 진입 연출.
// 중앙에서 펭귄컷 로고를 그린 뒤 좌상단 브랜드 위치로 날려 보내고,
// 상단바 → 타임라인 → 좌측 독 순서로 패널을 바운스 + 슬라이드 등장시킨다.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import './studioIntro.css';

export type StudioIntroPhase = 'intro' | 'flying' | 'revealing' | 'done';

// 각 단계 지속 시간은 studioIntro.css의 전환/애니메이션 길이와 일치시킨다.
const DRAW_MS = 1400;
const FLY_MS = 820;
const HAND_OFF_MS = 120;
const REVEAL_MS = 1350;

/**
 * 인트로를 건너뛸지 판단한다.
 * 새로고침·재방문에도 매번 재생하고, 모션 감소 설정 또는 ?intro=0 에서만 생략한다.
 * (?intro=1 은 재생을 명시적으로 강제하는 플래그)
 */
export function shouldSkipStudioIntro(): boolean {
  if (typeof window === 'undefined') return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('intro') === '1') return false;
  if (params.get('intro') === '0') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

interface StudioIntroProps {
  initialPhase: StudioIntroPhase;
  onPhaseChange: (phase: StudioIntroPhase) => void;
}

export function StudioIntro({ initialPhase, onPhaseChange }: StudioIntroProps) {
  const [phase, setPhase] = useState<StudioIntroPhase>(initialPhase);
  const [drawn, setDrawn] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<Animation | null>(null);

  // 부모의 루트 data-intro 속성과 내부 위상을 항상 동기화한다.
  useEffect(() => {
    onPhaseChange(phase);
  }, [phase, onPhaseChange]);

  // 첫 페인트 전에 실제 경로 길이를 주입해 draw 전환이 미리 시작되지 않게 한다.
  useLayoutEffect(() => {
    if (phase !== 'intro') return;
    const path = groupRef.current?.querySelector('path');
    if (path) {
      path.style.setProperty('--sv2-intro-len', String(Math.ceil(path.getTotalLength())));
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'intro') {
      // 레이아웃 반영 후 draw 시작 (dashoffset 초기값이 먼저 그려지도록)
      const raf = window.requestAnimationFrame(() => setDrawn(true));
      const timer = window.setTimeout(() => setPhase('flying'), DRAW_MS);
      return () => {
        window.cancelAnimationFrame(raf);
        window.clearTimeout(timer);
      };
    }

    if (phase === 'flying') {
      const group = groupRef.current;
      // 상단바는 아직 투명하지만 레이아웃은 잡혀 있어 목표 좌표를 측정할 수 있다.
      // 감싼 span(80×80)이 아니라 실제 SVG(≈61×80)를 기준으로 스케일을 계산해야
      // 상단바 로고와 크기·중심이 정확히 일치한다.
      const icon = group?.querySelector('svg');
      const target = document.querySelector('.sv2-brand-logo');
      if (icon && target) {
        const from = icon.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const scale = from.width > 0 ? to.width / from.width : 0.325;
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);

        flightRef.current?.cancel();
        flightRef.current = icon.animate(
          [
            { transform: 'translate(0px, 0px) scale(1)' },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          ],
          {
            duration: FLY_MS,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards',
          }
        );
      }
      const timer = window.setTimeout(() => setPhase('revealing'), FLY_MS + HAND_OFF_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'revealing') {
      const timer = window.setTimeout(() => setPhase('done'), REVEAL_MS);
      return () => window.clearTimeout(timer);
    }

    return;
  }, [phase]);

  // 언마운트 시에만 비행 애니메이션을 정리한다(단계 전환 중에는 유지).
  useEffect(
    () => () => {
      flightRef.current?.cancel();
    },
    []
  );

  if (phase === 'done') return null;

  return createPortal(
    <div className="sv2-intro-overlay" data-phase={phase} data-drawn={drawn} aria-hidden="true">
      <div className="sv2-intro-glow" />
      <div className="sv2-intro-group" ref={groupRef} data-phase={phase} data-drawn={drawn}>
        <span className="sv2-intro-icon">
          <PenguinLogo size={80} color="#191f28" />
        </span>
        <span className="sv2-intro-wordmark">PenguinCut</span>
      </div>
    </div>,
    document.body
  );
}
