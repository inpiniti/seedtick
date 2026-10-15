import React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse bg-[#f1f5f9] rounded-md", className)}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg p-5 sm:p-6 border border-[#e2e8f0] shadow-xs flex flex-col gap-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-3 w-full mt-2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
