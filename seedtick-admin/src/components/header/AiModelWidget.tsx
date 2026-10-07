"use client";

import React from "react";
import { AiModelStatus } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Cpu, RotateCcw } from "lucide-react";

interface AiModelWidgetProps {
  aiModel: AiModelStatus | null;
  isResetting: boolean;
  onReset: () => void;
}

export function AiModelWidget({ aiModel, isResetting, onReset }: AiModelWidgetProps) {
  const isFirst = aiModel?.is_first ?? true;
  const activeModel = aiModel?.active_model || "대기 중";
  const rankLabel = aiModel
    ? `${aiModel.active_index + 1}/${aiModel.chain.length}`
    : "-";

  return (
    <div className="inline-flex items-center gap-2 border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 rounded-md text-xs font-mono">
      <div className="flex items-center gap-1.5 min-w-0">
        <Cpu className={`w-3.5 h-3.5 shrink-0 ${isFirst ? "text-emerald-600" : "text-amber-600"}`} />
        <span className="text-[#64748b] text-[11px]">AI:</span>
        <span
          className="font-semibold text-[#0f172a] truncate max-w-[120px] sm:max-w-[160px]"
          title={activeModel}
        >
          {activeModel}
        </span>
      </div>

      {aiModel && (
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
              isFirst
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {isFirst ? "P1" : `P${rankLabel}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            isLoading={isResetting}
            disabled={isFirst && (aiModel?.switch_count ?? 0) === 0}
            className="h-5 px-1 text-[10px] text-[#64748b] hover:text-[#0f172a] rounded"
            title="모델 순위를 1순위로 리셋"
          >
            {!isResetting ? <RotateCcw className="w-2.5 h-2.5" /> : null}
          </Button>
        </div>
      )}
    </div>
  );
}