// components/ReportistLogo.tsx - Reportist 공식 브랜드 심볼
import React from 'react';

export interface ReportistLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  inverted?: boolean;
  color?: string;
  className?: string;
}

export function ReportistLogo({
  size = 20,
  inverted = false,
  color,
  className = '',
  style,
  ...props
}: ReportistLogoProps) {
  const activeColor = color ?? (inverted ? '#ffffff' : 'currentColor');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      <g transform="rotate(45 12 12)">
        <rect
          x="9.4"
          y="3.5"
          width="5.2"
          height="17"
          rx="2.6"
          stroke={activeColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M 9.4 9 L 9.4 6.1 C 9.4 4.66 10.56 3.5 12 3.5 C 13.44 3.5 14.6 4.66 14.6 6.1 L 14.6 9 Z"
          fill={activeColor}
        />
      </g>
    </svg>
  );
}

export interface ReportistLogoBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light' | 'ghost';
  className?: string;
}

export function ReportistLogoBadge({
  size = 'md',
  variant = 'dark',
  className = '',
}: ReportistLogoBadgeProps) {
  const sizeConfig = {
    xs: { box: 'w-5 h-5 rounded-[4px]', icon: 12 },
    sm: { box: 'w-6 h-6 rounded-md', icon: 14 },
    md: { box: 'w-8 h-8 rounded-lg', icon: 18 },
    lg: { box: 'w-9 h-9 rounded-lg', icon: 20 },
  }[size];

  const variantStyles = {
    dark: {
      backgroundColor: '#0f172a',
      color: '#ffffff',
      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
    light: {
      backgroundColor: '#ffffff',
      color: '#0f172a',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      border: '1px solid #cbd5e1',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'currentColor',
    },
  }[variant];

  return (
    <span
      className={`reportist-logo-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...variantStyles,
      }}
      aria-label="Reportist 로고"
    >
      <ReportistLogo size={sizeConfig.icon} inverted={variant === 'dark'} />
    </span>
  );
}

export default ReportistLogo;
