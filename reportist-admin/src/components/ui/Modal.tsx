import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: "default" | "wide" | "full";
}

export function Modal({ isOpen, onClose, children, className, size = "default" }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass =
    size === "wide"
      ? "sm:max-w-4xl"
      : size === "full"
      ? "sm:max-w-6xl"
      : "sm:max-w-2xl";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex min-h-full items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* 백드롭 배경 클릭 시 닫기 */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* aihero 스타일 정밀 모달 (모서리 rounded-md, 흑백 모노톤 보더) */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full my-auto bg-white rounded-md p-5 sm:p-6 shadow-2xl border border-[#cbd5e1] max-h-[90vh] flex flex-col animate-in fade-in zoom-in-98 duration-150",
          maxWidthClass,
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors cursor-pointer"
          aria-label="닫기"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("pr-8 mb-4 pb-3 border-b border-[#e2e8f0] shrink-0", className)}>
      <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] tracking-tight break-words">
        {title}
      </h3>
      {description ? (
        <p className="text-xs sm:text-sm text-[#64748b] mt-1 leading-relaxed break-words">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("py-1 text-sm text-[#334155] flex-1", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-5 pt-3 border-t border-[#e2e8f0] flex flex-wrap items-center justify-end gap-2.5 shrink-0 pb-safe",
        className
      )}
    >
      {children}
    </div>
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
