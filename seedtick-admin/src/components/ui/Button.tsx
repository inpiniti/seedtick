import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#3182f6] text-white hover:bg-[#1b64da] active:bg-[#1553b7] shadow-sm font-medium",
  secondary:
    "bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb] active:bg-[#d1d5db] font-medium",
  danger:
    "bg-[#fef0f1] text-[#f04452] hover:bg-[#fed7da] active:bg-[#fca5ab] font-medium",
  ghost:
    "bg-transparent text-[#6b7684] hover:bg-[#f2f4f6] active:bg-[#e5e8eb] font-medium",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-[38px] px-3.5 text-xs rounded-xl",
  md: "min-h-[44px] px-4 py-2 text-sm rounded-2xl", // 피츠의 법칙: 터치 타깃 최소 44px
  lg: "min-h-[48px] px-6 py-3 text-base rounded-2xl",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className,
      children,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 select-none transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
