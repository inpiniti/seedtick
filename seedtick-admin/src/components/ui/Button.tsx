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
    "bg-[#0f172a] text-white hover:bg-[#1e293b] active:bg-[#020617] border border-[#0f172a] font-medium shadow-xs",
  secondary:
    "bg-white text-[#334155] hover:bg-[#f8fafc] hover:text-[#0f172a] border border-[#cbd5e1] active:bg-[#f1f5f9] font-medium shadow-xs",
  danger:
    "bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 font-medium",
  ghost:
    "bg-transparent text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] active:bg-[#e2e8f0] font-medium",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-[32px] px-2.5 text-xs rounded-md",
  md: "h-[38px] px-3.5 text-xs sm:text-sm rounded-md",
  lg: "h-[44px] px-5 text-sm rounded-md",
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
          "inline-flex items-center justify-center gap-1.5 select-none transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
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
