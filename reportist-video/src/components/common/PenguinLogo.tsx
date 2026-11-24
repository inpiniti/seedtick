import React from "react";
import { PENGUIN_LOGO_PATH } from "./penguinLogoPath.ts";

export interface PenguinLogoProps extends React.SVGProps<SVGSVGElement> {
  /**
   * 아이콘의 가로/세로 크기 (px 단위 또는 CSS 단위)
   * @default 24
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
 * PenguinCut (펭귄컷) 공식 심볼 SVG 로고
 * - 네거티브 스페이스를 활용한 미니멀 펭귄 실루엣
 */
export function PenguinLogo({
  size = 24,
  inverted = false,
  color,
  className = "",
  style,
  ...props
}: PenguinLogoProps) {
  const activeColor = color ?? (inverted ? "#ffffff" : "currentColor");
  const computedWidth =
    typeof size === "number" ? Math.round((size * 64.24) / 84) : size;

  return (
    <svg
      width={computedWidth}
      height={size}
      viewBox="17.88 8 64.24 84"
      fill={activeColor}
      fillRule="evenodd"
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
      <path d={PENGUIN_LOGO_PATH} />
    </svg>
  );
}

export interface PenguinLogoBadgeProps {
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "dark" | "light" | "ghost";
  className?: string;
}

export function PenguinLogoBadge({
  size = "md",
  variant = "dark",
  className = "",
}: PenguinLogoBadgeProps) {
  const sizeConfig = {
    xs: { box: "w-5 h-5 rounded-[4px]", icon: 16 },
    sm: { box: "w-6 h-6 rounded-md", icon: 20 },
    md: { box: "w-8 h-8 rounded-lg", icon: 26 },
    lg: { box: "w-9 h-9 rounded-lg", icon: 30 },
  }[size];

  const variantStyles = {
    dark: {
      backgroundColor: "#0f172a",
      color: "#ffffff",
      boxShadow: "0 2px 6px rgba(15, 23, 42, 0.25)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
    },
    light: {
      backgroundColor: "#ffffff",
      color: "#0f172a",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
      border: "1px solid #cbd5e1",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "currentColor",
    },
  }[variant];

  return (
    <span
      className={`penguin-logo-badge ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...variantStyles,
      }}
      aria-label="PenguinCut"
    >
      <PenguinLogo size={sizeConfig.icon} inverted={variant === "dark"} />
    </span>
  );
}

export default PenguinLogo;
