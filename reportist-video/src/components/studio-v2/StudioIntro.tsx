// components/studio-v2/StudioIntro.tsx — 스튜디오 첫 진입 연출.
// 중앙에서 펭귄컷 로고를 그린 뒤 심볼과 워드마크가 함께 좌상단으로 날아간다.
// 패널 등장이 끝나면 같은 자리에서 실제 상단바 브랜드로 조용히 교체하고 오버레이를 제거한다.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import { getLandingPath, useI18n } from '../../i18n/index.tsx';
import './studioIntro.css';

export type StudioIntroPhase = 'intro' | 'flying' | 'revealing' | 'pinned' | 'handoff' | 'done';

// 각 단계 지속 시간은 studioIntro.css의 전환/애니메이션 길이와 일치시킨다.
const DRAW_MS = 1400;
const FLY_MS = 820;
const HAND_OFF_MS = 120;
const REVEAL_MS = 2100;
// 로고가 도착한 뒤 잠시 고정했다가, 실제 브랜드와 100ms 동안 교차 페이드한다.
const PIN_HOLD_MS = 160;
const SWAP_MS = 100;

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
  const { locale } = useI18n();
  const [phase, setPhase] = useState<StudioIntroPhase>(initialPhase);
  const [drawn, setDrawn] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<Animation | null>(null);
  // 비행 최종 transform을 기억해 고정 직전 실측 보정을 한 번만 적용한다.
  const finalTransformRef = useRef<{ dx: number; dy: number; scale: number } | null>(null);

  // 부모의 루트 data-intro 속성과 내부 위상을 항상 동기화한다.
  useEffect(() => {
    onPhaseChange(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    if (phase === 'intro') {
      // 레이아웃 반영 후 드로잉 시작 (clip-path 초기값이 먼저 그려지도록)
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
      // 감싼 span이 아닌 실제 SVG를 기준으로 스케일을 계산해야 목표 로고와 정확히 겹친다.
      const icon = group?.querySelector('.sv2-intro-fill');
      const target = document.querySelector('.sv2-brand');
      const targetIcon = document.querySelector('.sv2-brand-logo');
      if (group && icon && target && targetIcon) {
        const g = group.getBoundingClientRect();
        const i = icon.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        const ti = targetIcon.getBoundingClientRect();
        const scale = i.width > 0 ? ti.width / i.width : 0.325;
        // 상단바 브랜드(15px/700/-0.02em/gap 8px)와 스케일 후에도 1:1로 같아지도록
        // 워드마크 타이포와 간격을 스케일의 역수로 보정한다.
        group.style.setProperty('--sv2-intro-scale', String(scale));
        const gx = g.left + g.width / 2;
        const gy = g.top + g.height / 2;
        // 아이콘 중심 하나가 아니라 브랜드 전체 박스 중심에 맞춘다(글자 위치까지 함께 정렬).
        const dx = t.left + t.width / 2 - gx;
        const dy = t.top + t.height / 2 - gy;
        finalTransformRef.current = { dx, dy, scale };

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
      // 도착 직후 바로 패널이 튀어나오지 않도록 짧은 홀드를 둔다.
      const timer = window.setTimeout(() => setPhase('revealing'), FLY_MS + HAND_OFF_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'revealing') {
      const timer = window.setTimeout(() => setPhase('pinned'), REVEAL_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'pinned') {
      const timer = window.setTimeout(() => setPhase('handoff'), PIN_HOLD_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'handoff') {
      // 같은 위치에서 실제 상단바 브랜드가 나타나고 오버레이 로고는 사라진다.
      const timer = window.setTimeout(() => setPhase('done'), SWAP_MS);
      return () => window.clearTimeout(timer);
    }

    return;
  }, [phase]);

  // 비행이 끝난 뒤 오버레이와 실제 브랜드 박스를 한 번 실측해 맞춘다(FLIP 보정).
  // 이후 100ms 안에 실제 브랜드로 교체되므로 보정 자체는 눈에 띄지 않는다.
  useEffect(() => {
    if (phase !== 'pinned') return;
    const group = groupRef.current;
    const brand = document.querySelector('.sv2-brand');
    const finalTransform = finalTransformRef.current;
    if (!group || !brand || !finalTransform) return;

    const g = group.getBoundingClientRect();
    const b = brand.getBoundingClientRect();
    const corrX = b.left + b.width / 2 - (g.left + g.width / 2);
    const corrY = b.top + b.height / 2 - (g.top + g.height / 2);

    flightRef.current?.cancel();
    flightRef.current = null;
    group.style.transform = `translate(${finalTransform.dx + corrX}px, ${
      finalTransform.dy + corrY
    }px) scale(${finalTransform.scale})`;
  }, [phase]);

  // 언마운트 시에만 비행 애니메이션을 정리한다(단계 전환 중에는 유지).
  useEffect(
    () => () => {
      flightRef.current?.cancel();
    },
    []
  );

  if (phase === 'done') return null;

  const showBackdrop = phase === 'intro' || phase === 'flying' || phase === 'revealing';

  return createPortal(
    <>
      {showBackdrop && (
        <div className="sv2-intro-backdrop" data-phase={phase} data-drawn={drawn} aria-hidden="true">
          <div className="sv2-intro-glow" />
        </div>
      )}
      <div className="sv2-intro-group" ref={groupRef} data-phase={phase} data-drawn={drawn}>
        <a
          className="sv2-intro-brand"
          href={getLandingPath(locale)}
          aria-label="PenguinCut"
          tabIndex={phase === 'pinned' ? 0 : -1}
        >
          <span className="sv2-intro-icon">
            {/* 실제 채우기 로고를 점진 노출해 처음부터 펭귄컷임이 보이게 한다. */}
            <PenguinLogo size={80} className="sv2-intro-fill" />
            {/* 노출되는 경계를 따라 얇은 외곽선을 겹쳐 '그려지는' 느낌을 준다. */}
            <PenguinLogo size={80} className="sv2-intro-outline" />
          </span>
          <span className="sv2-intro-wordmark">PenguinCut</span>
        </a>
      </div>
    </>,
    document.body
  );
}
