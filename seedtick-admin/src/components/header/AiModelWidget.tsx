"use client";

import React from "react";
import { AiModelStatus } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Bot, RotateCcw } from "lucide-react";

interface AiModelWidgetProps {
  aiModel: AiModelStatus | null;
  isResetting: boolean;
  onReset: () => void;
}

/**
 * 현재 사용 중인 AI 모델 위젯.
 *
 * 1순위 모델이 프로바이더 과부하로 실패하면 서버가 자동으로 다음 순위로 내려간다.
 * 여기서는 현재 어느 순위에 있는지와, 왜 내려왔는지를 보여준다.
 */
export function AiModelWidget({ aiModel, isResetting, onReset }: AiModelWidgetProps) {
  // 1순위 상태면 초록, 우회 상태면 주황
  const isFirst = aiModel?.is_first ?? true;
  const rankLabel = aiModel ? `${aiModel.active_index + 1}/${aiModel.chain.length}순위` : "확인 중...";

  return (
    <div className="bg-[#f9fafb] border border-[#e5e8eb] px-3 py-2 sm:py-1.5 rounded-2xl">
      <div className="flex items-center gap-1.5">
        <Bot className={`w-3.5 h-3.5 shrink-0 ${isFirst ? "text-[#03b26c]" : "text-[#ff9500]"}`} />
        <span className="text-[#8b95a1] text-[11px] sm:text-xs font-medium shrink-0">AI:</span>
        <span
          className={`font-bold text-[11px] sm:text-xs truncate ${
            isFirst ? "text-[#03b26c]" : "text-[#ff9500]"
          }`}
          title={aiModel?.active_model || ""}
        >
          {aiModel?.active_model || "확인 중..."}
        </span>
      </div>

      {aiModel && (
        <div className="flex items-center gap-1.5 mt-1 pl-5">
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
              isFirst ? "bg-[#e6f7ef] text-[#03b26c]" : "bg-[#fff4e5] text-[#ff9500]"
            }`}
          >
            {isFirst ? "기본값" : rankLabel}
          </span>
          {aiModel.switch_count > 0 && (
            <span className="text-[10px] text-[#8b95a1]">오늘 {aiModel.switch_count}회 전환</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            isLoading={isResetting}
            disabled={isFirst && (aiModel?.switch_count ?? 0) === 0}
            className="h-5 px-1.5 text-[10px] rounded-md text-[#8b95a1] hover:text-[#3182f6]"
            title="모델 순위를 1순위로 되돌립니다"
          >
            {!isResetting ? <RotateCcw className="w-2.5 h-2.5" /> : null}
            초기화
          </Button>
        </div>
      )}
    </div>
  );
}