// components/common/CountUpNumber.tsx
// script-to-motion 기법: 값 자체를 " cue "로 삼아 easeOut 곡선으로 트위닝하는 숫자.
// rAF 기반이라 GSAP 타임라인과 같은 프레임 모델을 쓰고, 모션 축소 환경에서는 최종값만 보여준다.
import { useEffect, useRef, useState } from 'react';

interface CountUpNumberProps {
  value: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export const CountUpNumber = ({
  value,
  suffix = '',
  durationMs = 420,
  className,
}: CountUpNumberProps) => {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    const to = value;
    if (from === to || prefersReducedMotion()) {
      shownRef.current = to;
      setShown(to);
      return;
    }

    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / Math.max(1, durationMs));
      const next = from + (to - from) * easeOutCubic(t);
      shownRef.current = next;
      setShown(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, durationMs]);

  return (
    <span className={className} aria-label={`${Math.round(value)}${suffix}`}>
      {Math.round(shown)}
      {suffix}
    </span>
  );
};
