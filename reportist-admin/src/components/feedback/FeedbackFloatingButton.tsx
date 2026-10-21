"use client";
import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { FeedbackWriteModal } from "./FeedbackWriteModal";
import { FeedbackItem } from "@/types/feedback";

interface FeedbackFloatingButtonProps {
  onFeedbackCreated?: (item: FeedbackItem) => void;
}

export function FeedbackFloatingButton({ onFeedbackCreated }: FeedbackFloatingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/feedback") return null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 group">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="min-h-[52px] h-[52px] px-4 rounded-full bg-[#0f172a] hover:bg-[#1e293b] active:bg-[#020617] text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 cursor-pointer border border-slate-700/60"
          aria-label="서비스 의견 및 기능 제안 보내기"
        >
          <MessageSquarePlus className="w-5 h-5 text-[#3182f6] group-hover:scale-110 transition-transform" />
          <span className="text-xs sm:text-sm font-bold tracking-tight">
            의견 보내기
          </span>
        </button>
      </div>

      <FeedbackWriteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={(newItem) => {
          onFeedbackCreated?.(newItem);
        }}
      />
    </>
  );
}
