import React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon = "📄",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg bg-white border border-[#e2e8f0]",
        className
      )}
    >
      <div className="text-3xl mb-3 select-none text-[#94a3b8]">{icon}</div>
      <h4 className="text-sm sm:text-base font-bold text-[#0f172a] mb-1">{title}</h4>
      {description ? (
        <p className="text-xs sm:text-sm text-[#64748b] max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
