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
  primary: "bg-blue-50/80 text-blue-700 border-blue-200",
  success: "bg-emerald-50/80 text-emerald-700 border-emerald-200",
  danger: "bg-rose-50/80 text-rose-700 border-rose-200",
  warning: "bg-amber-50/80 text-amber-700 border-amber-200",
  neutral: "bg-slate-50 text-slate-600 border-slate-200",
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
