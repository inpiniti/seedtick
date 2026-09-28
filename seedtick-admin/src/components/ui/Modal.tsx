import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, children, className }: ModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      {/* 백드롭 배경 클릭 시 닫기 */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모바일에서는 바텀시트, PC에서는 중앙 모달 */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#f2f4f6] max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200",
          className
        )}
      >
        {/* 모바일 바텀시트 핸들 바 */}
        <div className="w-10 h-1.5 bg-[#d1d5db] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-full text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
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
    <div className={cn("pr-8 mb-4 shrink-0", className)}>
      <h3 className="text-lg sm:text-xl font-bold text-[#191f28] tracking-tight">
        {title}
      </h3>
      {description ? (
        <p className="text-xs text-[#8b95a1] mt-1 leading-relaxed">
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
    <div className={cn("py-1 text-sm text-[#4e5968] flex-1", className)}>
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
        "mt-5 pt-3 border-t border-[#f2f4f6] flex items-center justify-end gap-2.5 shrink-0 pb-safe",
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
