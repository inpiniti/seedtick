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
  icon = "📭",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center rounded-3xl bg-white border border-[#f2f4f6]",
        className
      )}
    >
      <div className="text-4xl mb-3 select-none">{icon}</div>
      <h4 className="text-base font-bold text-[#191f28] mb-1">{title}</h4>
      {description ? (
        <p className="text-xs text-[#8b95a1] max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
