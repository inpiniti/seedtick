// components/studio-v2/StudioIntro.tsx — 스튜디오 첫 진입 연출.
// 중앙에서 펭귄컷 로고를 그린 뒤 좌상단 브랜드 위치로 날려 보내고,
// 상단바 → 타임라인 → 좌측 독 순서로 패널을 바운스 + 슬라이드 등장시킨다.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import './studioIntro.css';

export type StudioIntroPhase = 'intro' | 'flying' | 'revealing' | 'done';

const DRAW_MS = 1100;
const FLY_MS = 620;
const REVEAL_MS = 900;
const INTRO_SEEN_KEY = 'sv2-intro-seen';

/**
 * 인트로를 건너뛸지 판단한다.
 * - 모션 감소 설정/세션 내 재방문은 즉시 본 화면으로 진입
 * - ?intro=1 이면 세션 기록과 무관하게 다시 재생 (개발·데모용)
 * - ?intro=0 이면 명시적으로 비활성화
 */
export function shouldSkipStudioIntro(): boolean {
  if (typeof window === 'undefined') return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('intro') === '1') return false;
  if (params.get('intro') === '0') return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

interface StudioIntroProps {
  initialPhase: StudioIntroPhase;
  onPhaseChange: (phase: StudioIntroPhase) => void;
}

export function StudioIntro({ initialPhase, onPhaseChange }: StudioIntroProps) {
  const [phase, setPhase] = useState<StudioIntroPhase>(initialPhase);
  const [drawn, setDrawn] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
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
      const icon = iconRef.current;
      // 상단바는 아직 투명하지만 레이아웃은 잡혀 있어 목표 좌표를 측정할 수 있다.
      const target = document.querySelector('.sv2-brand-logo');
      if (group && icon && target) {
        const g = group.getBoundingClientRect();
        const i = icon.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        const scale = i.width > 0 && t.width > 0 ? Math.max(0.05, t.width / i.width) : 0.3;
        const gx = g.left + g.width / 2;
        const gy = g.top + g.height / 2;
        // 그룹 중심 기준으로 스케일링하므로 아이콘 중심이 목표에 정확히 닿도록 보정한다.
        const dx = t.left + t.width / 2 - gx - (i.left + i.width / 2 - gx) * scale;
        const dy = t.top + t.height / 2 - gy - (i.top + i.height / 2 - gy) * scale;

        flightRef.current?.cancel();
        flightRef.current = group.animate(
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
      const timer = window.setTimeout(() => setPhase('revealing'), FLY_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'revealing') {
      const timer = window.setTimeout(() => setPhase('done'), REVEAL_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'done') {
      try {
        window.sessionStorage.setItem(INTRO_SEEN_KEY, '1');
      } catch {
        // storage 차단 환경에서는 세션 내 반복 재생을 허용한다.
      }
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
        <span className="sv2-intro-icon" ref={iconRef}>
          <PenguinLogo size={80} color="#191f28" />
        </span>
        <span className="sv2-intro-wordmark">PenguinCut</span>
      </div>
    </div>,
    document.body
  );
}
