import React from "react";

export interface SeedTickLogoProps extends React.SVGProps<SVGSVGElement> {
  /**
   * 아이콘의 가로/세로 크기 (px 단위 또는 CSS 단위)
   * @default 20
   */
  size?: number | string;
  /**
   * 색상 반전 여부 (true일 경우 흰색 #ffffff 강제 적용)
   * @default false
   */
  inverted?: boolean;
  /**
   * 커스텀 색상 (지정하지 않을 경우 currentColor 사용)
   */
  color?: string;
  className?: string;
}

/**
 * SeedTick 브랜드 심볼 SVG 로고
 * - 45도 기울어진 미니멀 막대/완드 형태
 * - 상단 끝부분(Tip)은 솔리드로 채워져 있고, 하단 바디는 클린한 아웃라인으로 마감
 * - 흑백 상자/다크 모드 등 부모 색상에 따라 currentColor로 자동 반응하거나 inverted=true로 반전 가능
 */
export function SeedTickLogo({
  size = 20,
  inverted = false,
  color,
  className = "",
  style,
  ...props
}: SeedTickLogoProps) {
  const activeColor = color ?? (inverted ? "#ffffff" : "currentColor");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      <g transform="rotate(45 12 12)">
        {/* 전체 바디 아웃라인 (둥근 캡슐 직사각형) */}
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
        {/* 상단 채워진 팁 (Solid Filled Tip) */}
        <path
          d="M 9.4 9 L 9.4 6.1 C 9.4 4.66 10.56 3.5 12 3.5 C 13.44 3.5 14.6 4.66 14.6 6.1 L 14.6 9 Z"
          fill={activeColor}
        />
      </g>
    </svg>
  );
}

export interface SeedTickLogoBadgeProps {
  /**
   * 뱃지 크기 프리셋
   * @default "md"
   */
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * 뱃지 스타일 변형
   * - "dark": 흑색 상자 배경에 백색 반전 로고 (기본)
   * - "light": 백색 상자 배경에 흑색 로고
   * - "ghost": 배경 없이 단독 아이콘
   */
  variant?: "dark" | "light" | "ghost";
  className?: string;
}

/**
 * 흑백 상자 안에 담긴 SeedTick 로고 뱃지
 * - dark 변형: 흑색 상자(#0f172a) 안에서 로고가 흰색으로 완벽히 반전됨
 * - light 변형: 백색 상자 안에서 로고가 검은색으로 표시됨
 */
export function SeedTickLogoBadge({
  size = "md",
  variant = "dark",
  className = "",
}: SeedTickLogoBadgeProps) {
  const sizeConfig = {
    xs: { box: "w-5 h-5 rounded-[4px]", icon: 12 },
    sm: { box: "w-6 h-6 rounded-md", icon: 14 },
    md: { box: "w-7 h-7 rounded-md", icon: 16 },
    lg: { box: "w-9 h-9 rounded-lg", icon: 20 },
  }[size];

  const variantClasses = {
    dark: "bg-[#0f172a] text-white shadow-xs border border-slate-800/80",
    light: "bg-white text-[#0f172a] border border-[#cbd5e1] shadow-xs",
    ghost: "bg-transparent text-current",
  }[variant];

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 transition-colors ${sizeConfig.box} ${variantClasses} ${className}`}
      aria-label="SeedTick 로고"
    >
      <SeedTickLogo size={sizeConfig.icon} inverted={variant === "dark"} />
    </span>
  );
}

export default SeedTickLogo;
