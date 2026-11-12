// src/components/common/ShinyText.tsx
// Official ReactBits Shiny Text implementation
// Adds a metallic sheen or light beam that sweeps across text on a loop.

import React from 'react';
import './AiVisualEffects.css';

export interface ShinyTextProps {
  children?: React.ReactNode;
  text?: string;
  disabled?: boolean;
  speed?: number; // duration in seconds (default: 4s)
  className?: string;
  color?: string; // base text color
  shineColor?: string; // highlight beam color
  theme?: 'light' | 'dark';
  style?: React.CSSProperties;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  children,
  text,
  disabled = false,
  speed = 4,
  className = '',
  color,
  shineColor,
  theme = 'dark',
  style,
}) => {
  const content = text ?? children;
  const animationDuration = `${speed}s`;

  const effectiveColor = color || (theme === 'light' ? '#1d4ed8' : '#b5b5b5a4');
  const effectiveShine = shineColor || (theme === 'light' ? '#38bdf8' : 'rgba(255, 255, 255, 0.95)');

  return (
    <span
      className={`shiny-text-root ${disabled ? 'disabled' : 'animate-shine'} ${className}`}
      style={{
        color: effectiveColor,
        // 베이스 컬러 위에 하이라이트 빔을 겹쳐 실제로 반짝이는 질감이 보이도록 2중 그라디언트 사용
        backgroundImage: `linear-gradient(120deg, rgba(255, 255, 255, 0) 40%, ${effectiveShine} 50%, rgba(255, 255, 255, 0) 60%), linear-gradient(${effectiveColor}, ${effectiveColor})`,
        backgroundSize: '200% 100%, 100% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animationDuration,
        ...style,
      }}
    >
      {content}
    </span>
  );
};

export default ShinyText;
