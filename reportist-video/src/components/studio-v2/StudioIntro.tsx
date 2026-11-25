// components/studio-v2/StudioIntro.tsx — 스튜디오 첫 진입 연출.
// 중앙에서 펭귄컷 로고를 왼쪽→오른쪽으로 그려낸 뒤(실제 채우기 점진 노출),
// 심볼과 워드마크가 함께 좌상단 브랜드 위치로 날아가 그 자리에 고정된다.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenguinLogo } from '../common/PenguinLogo.tsx';
import { getLandingPath, useI18n } from '../../i18n/index.tsx';
import './studioIntro.css';

export type StudioIntroPhase = 'intro' | 'flying' | 'revealing' | 'pinned' | 'done';

// 각 단계 지속 시간은 studioIntro.css의 전환/애니메이션 길이와 일치시킨다.
const DRAW_MS = 1400;
const FLY_MS = 820;
const HAND_OFF_MS = 120;
const REVEAL_MS = 2100;

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
  // 뷰포트가 바뀌어도 아이콘을 같은 브랜드 좌표에 다시 붙이기 위한 비행 기하값.
  const flightGeometryRef = useRef<{ offsetX: number; offsetY: number; scale: number } | null>(null);

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
      const target = document.querySelector('.sv2-brand-logo');
      if (group && icon && target) {
        const g = group.getBoundingClientRect();
        const i = icon.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        const scale = i.width > 0 ? t.width / i.width : 0.325;
        const gx = g.left + g.width / 2;
        const gy = g.top + g.height / 2;
        // 그룹 중심 기준으로 스케일링하므로 아이콘 중심이 목표에 닿도록 보정한다.
        const offsetX = i.left + i.width / 2 - gx;
        const offsetY = i.top + i.height / 2 - gy;
        flightGeometryRef.current = { offsetX, offsetY, scale };
        const dx = t.left + t.width / 2 - gx - offsetX * scale;
        const dy = t.top + t.height / 2 - gy - offsetY * scale;

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

    // pinned: 비행 애니메이션(fill: forwards)이 적용된 채 로고를 그대로 유지한다.
    return;
  }, [phase]);

  // 고정된 로고는 뷰포트 중앙 기준으로 배치되므로, 창 크기가 바뀌면
  // 실제 상단바 로고 좌표를 다시 측정해 같은 자리에 다시 붙인다.
  useEffect(() => {
    if (phase !== 'pinned') return;

    const pinToBrand = () => {
      const group = groupRef.current;
      const geometry = flightGeometryRef.current;
      const target = document.querySelector('.sv2-brand-logo');
      if (!group || !geometry || !target) return;

      // WAAPI의 fill: forwards 대신 인라인 transform으로 전환해 재계산 값을 유지한다.
      flightRef.current?.cancel();
      flightRef.current = null;

      const gx = window.innerWidth / 2;
      const gy = window.innerHeight / 2;
      const t = target.getBoundingClientRect();
      const dx = t.left + t.width / 2 - gx - geometry.offsetX * geometry.scale;
      const dy = t.top + t.height / 2 - gy - geometry.offsetY * geometry.scale;
      group.style.transform = `translate(${dx}px, ${dy}px) scale(${geometry.scale})`;
    };

    pinToBrand();
    window.addEventListener('resize', pinToBrand);
    return () => window.removeEventListener('resize', pinToBrand);
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
    <>
      {phase !== 'pinned' && (
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
