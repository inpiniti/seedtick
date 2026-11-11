// src/components/common/BorderBeam.tsx
// Cult UI inspired Border Beam Animation
// 무지개 색상 없이 순백색(White) 빛의 빔이 카드 중앙 회전 없이 오직 보더 라인 위에서만 순환합니다.

import React from 'react';
import './AiVisualEffects.css';

export interface BorderBeamProps {
  size?: number; // length of beam in px (optional)
  duration?: number; // loop duration in seconds (default: 6s)
  delay?: number; // animation delay in seconds (default: 0s)
  borderWidth?: number; // border beam width in px (default: 1.5px)
  colorFrom?: string; // start gradient color (default: #ffffff)
  colorTo?: string; // end gradient color (default: rgba(255, 255, 255, 0.2))
  reverse?: boolean; // reverse rotation direction
  className?: string;
  style?: React.CSSProperties;
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  duration = 6,
  delay = 0,
  borderWidth = 1.5,
  colorFrom = '#ffffff',
  colorTo = 'rgba(255, 255, 255, 0.2)',
  reverse = false,
  className = '',
  style,
}) => {
  const dynamicStyles: React.CSSProperties = {
    '--beam-duration': `${duration}s`,
    '--beam-delay': `${delay}s`,
    '--beam-border-width': `${borderWidth}px`,
    '--beam-color-from': colorFrom,
    '--beam-color-to': colorTo,
    ...style,
  } as React.CSSProperties;

  return (
    <span
      className={`border-beam-overlay ${reverse ? 'reverse' : ''} ${className}`}
      aria-hidden="true"
      style={dynamicStyles}
    >
      <span className="border-beam-core" />
    </span>
  );
};

export default BorderBeam;
