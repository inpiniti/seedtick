import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "primary"
  | "success"
  | "danger"
  | "warning"
  | "neutral";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-[#0f172a] text-white border-[#0f172a]",
  success: "bg-[#0f172a] text-white border-[#0f172a]",
  danger: "bg-white text-[#0f172a] border border-[#64748b]",
  warning: "bg-[#f1f5f9] text-[#334155] border-[#cbd5e1]",
  neutral: "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]",
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-medium rounded border tracking-tight transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
