import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-[#e2e8f0] p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1 pb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base sm:text-lg font-bold text-[#0f172a] tracking-tight flex items-center justify-between",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs sm:text-sm text-[#64748b] leading-relaxed", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pt-1", className)} {...props}>{children}</div>;
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("pt-4 mt-4 border-t border-[#e2e8f0] flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;
