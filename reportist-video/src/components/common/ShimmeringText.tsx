// src/components/common/ShimmeringText.tsx
// animate-ui의 ShimmeringText 동작을 로컬로 재현한 컴포넌트.
// 글자(grapheme)마다 순차적으로 밝아졌다 돌아오는 글로우를 주고,
// 화면 밖·탭 숨김·모션 감소 환경에서는 애니메이션을 멈춘다.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './ShimmeringText.css';

export interface ShimmeringTextProps {
  text: string;
  /** 글자 하나가 빛나는 시간(초). 기본 1초. */
  duration?: number;
  /** 빛이 지날 때 글자를 살짝 들어 올린다. */
  wave?: boolean;
  color?: string;
  shimmeringColor?: string;
  className?: string;
  style?: CSSProperties;
}

type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' }
) => { segment(input: string): Iterable<{ segment: string }> };

function splitGraphemes(text: string): string[] {
  // 이모지·악센트 문자가 쪼개지지 않도록 grapheme 단위로 자른다.
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

export function ShimmeringText({
  text,
  duration = 1,
  wave = false,
  color,
  shimmeringColor,
  className = '',
  style,
}: ShimmeringTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const letters = useMemo(() => splitGraphemes(text), [text]);

  const count = Math.max(1, letters.length);
  // 한 글자당 1/4 구간만 빛나고 나머지는 쉬도록 cycle을 고정한다.
  // keyframes를 정적으로 유지해 진행률 텍스트가 바뀌어도 애니메이션이 처음부터 다시 시작하지 않는다.
  const cycle = duration * 4;
  const rest = Math.min(0.05 * count, duration * 2);
  const stagger = (cycle - duration - rest) / Math.max(1, count - 1);

  // 보이지 않는 곳에서 애니메이션을 돌리지 않는다.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let inView = true;
    const sync = () => setPaused(!inView || document.hidden);

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            inView = entries[0]?.isIntersecting ?? true;
            sync();
          });
    observer?.observe(root);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const rootStyle = {
    '--shimmer-duration': `${cycle}s`,
    ...(color ? { '--shimmer-color': color } : {}),
    ...(shimmeringColor ? { '--shimmering-color': shimmeringColor } : {}),
    ...style,
  } as CSSProperties;

  return (
    <span
      ref={rootRef}
      className={`shimmering-text ${className}`.trim()}
      data-paused={paused ? 'true' : undefined}
      data-wave={wave ? 'true' : undefined}
      style={rootStyle}
    >
      {/* 스크린리더는 글자 단위가 아닌 문장 전체를 한 번만 읽는다. */}
      <span className="shimmering-text-sr-only">{text}</span>
      <span className="shimmering-text-letters" aria-hidden="true">
        {letters.map((letter, index) => (
          <span
            key={index}
            className="shimmering-text-letter"
            style={{ animationDelay: `${index * stagger}s` }}
          >
            {letter === ' ' ? '\u00a0' : letter}
          </span>
        ))}
      </span>
    </span>
  );
}

export default ShimmeringText;
