"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  Play,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { PipelineProgress } from "@/types/api";

interface PipelineProgressCardProps {
  progress: PipelineProgress | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const STATUS_META: Record<
  PipelineProgress["status"],
  { label: string; variant: "primary" | "success" | "danger" | "warning" | "neutral" }
> = {
  idle: { label: "대기 중", variant: "neutral" },
  running: { label: "실행 중", variant: "primary" },
  completed: { label: "완료", variant: "success" },
  failed: { label: "실패", variant: "danger" },
  skipped: { label: "스킵됨", variant: "warning" },
};

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}시간 ${m}분 ${sec}초`;
  if (m > 0) return `${m}분 ${sec}초`;
  return `${sec}초`;
}

/** 실행 중 경과 시간을 1초 단위로 갱신하는 소형 컴포넌트 (카드 전체 재렌더 방지) */
function LiveElapsed({
  startedAt,
  finishedAt,
  running,
}: {
  startedAt: string | null;
  finishedAt: string | null;
  running: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running || !startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, startedAt]);

  if (!startedAt) return <>0초</>;
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  return <>{formatElapsed(Math.max(0, (end - start) / 1000))}</>;
}

export function PipelineProgressCard({
  progress,
  isLoading,
  onRefresh,
}: PipelineProgressCardProps) {
  const status = progress?.status ?? "idle";
  const isRunning = status === "running";
  const meta = STATUS_META[status];

  // 아직 한 번도 실행되지 않은 최초 상태는 간결한 안내만 노출
  if (!progress || status === "idle") {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#f2f4f6] text-[#8b95a1] flex items-center justify-center shrink-0">
              <Play className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#191f28]">
                13인 거장 파이프라인 대기 중
              </div>
              <p className="text-[11px] text-[#8b95a1] mt-0.5">
                {isLoading
                  ? "진행 상태를 확인하고 있어요..."
                  : "파이프라인을 실행하면 분석 단계가 이곳에 표시돼요."}
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] transition-colors cursor-pointer"
              title="진행 상태 수동 새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </Card>
    );
  }

  const total = progress.total_tickers;
  const done = progress.completed_tickers;
  const failed = progress.failed_tickers;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const currentIdx = progress.stage_index;
  const showGurus = progress.gurus_total > 0;

  return (
    <Card
      className={`p-4 sm:p-6 ${
        isRunning ? "border-[#3182f6]/40 ring-1 ring-[#3182f6]/10" : ""
      }`}
    >
      <Card.Header className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity
              className={`w-4 h-4 ${isRunning ? "text-[#3182f6] animate-pulse" : "text-[#8b95a1]"}`}
            />
            <span className="text-sm font-bold text-[#191f28]">
              13인 거장 파이프라인 진행 상황
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#6b7684] bg-[#f2f4f6] px-2.5 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <LiveElapsed
                startedAt={progress.started_at}
                finishedAt={progress.finished_at}
                running={isRunning}
              />
            </span>
            <Badge variant={meta.variant}>
              {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {meta.label}
            </Badge>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1 rounded-lg text-[#8b95a1] hover:text-[#191f28] hover:bg-[#f2f4f6] transition-colors cursor-pointer"
                title="진행 상태 수동 새로고침"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </Card.Header>

      <Card.Content className="space-y-4">
        {/* 1. 전체 종목 진행률 (n/총) */}
        <div className="p-3.5 rounded-2xl bg-[#f8fafd] border border-[#3182f6]/15">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-[#6b7684]">
                보고서 생성 진행률
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#191f28] mt-0.5">
                <span className="text-[#3182f6]">{done}</span>
                <span className="text-[#8b95a1] text-base font-bold"> / {total || "?"}</span>
                {failed > 0 ? (
                  <span className="ml-2 text-xs font-bold text-[#f04452]">실패 {failed}</span>
                ) : null}
              </div>
            </div>
            <div className="text-right min-w-0">
              {progress.current_ticker ? (
                <>
                  <div className="text-[11px] font-semibold text-[#8b95a1]">현재 분석 종목</div>
                  <div className="text-sm font-bold text-[#191f28] truncate">
                    {progress.current_ticker_index > 0 ? `${progress.current_ticker_index}. ` : ""}
                    {progress.current_ticker}
                  </div>
                </>
              ) : (
                <div className="text-[11px] font-semibold text-[#8b95a1]">
                  {status === "running" ? "스크리닝 중..." : "종목 확정 대기"}
                </div>
              )}
            </div>
          </div>

          {/* 진행 바 */}
          <div className="mt-3 h-2 rounded-full bg-[#e5e8eb] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                status === "failed" ? "bg-[#f04452]" : "bg-[#3182f6]"
              }`}
              style={{ width: `${total > 0 ? pct : 0}%` }}
            />
          </div>
        </div>

        {/* 2. 단계별 스테퍼 */}
        <div className="space-y-1">
          {progress.stages.map((stage, idx) => {
            const isDone = idx < currentIdx || status === "completed" || status === "skipped";
            const isActive = idx === currentIdx && isRunning;
            const isFailed = idx === currentIdx && status === "failed";
            const isSummaries = stage.key === "summaries";
            return (
              <div
                key={stage.key}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors ${
                  isActive ? "bg-[#e8f3ff]" : ""
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    isFailed
                      ? "bg-[#fef0f1] text-[#f04452]"
                      : isDone
                        ? "bg-[#e6f8f0] text-[#03b26c]"
                        : isActive
                          ? "bg-[#3182f6] text-white"
                          : "bg-[#f2f4f6] text-[#b0b8c1]"
                  }`}
                >
                  {isFailed ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : isActive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    idx
                  )}
                </span>
                <span
                  className={`text-xs font-semibold flex-1 min-w-0 truncate ${
                    isActive || isDone ? "text-[#191f28]" : "text-[#8b95a1]"
                  }`}
                >
                  {stage.label}
                </span>
                {isSummaries && showGurus ? (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      isActive
                        ? "bg-white text-[#3182f6]"
                        : "bg-[#f2f4f6] text-[#6b7684]"
                    }`}
                  >
                    {progress.gurus_done}/{progress.gurus_total}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* 3. 최근 진행 로그 */}
        {progress.events.length > 0 ? (
          <div className="pt-1">
            <div className="text-[11px] font-semibold text-[#8b95a1] mb-1.5">
              최근 진행 로그
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {progress.events
                .slice(-4)
                .reverse()
                .map((ev, i) => (
                  <div
                    key={`${ev.time}-${i}`}
                    className="flex items-start gap-1.5 text-[11px] text-[#6b7684]"
                  >
                    <MinusCircle className="w-3 h-3 mt-0.5 shrink-0 text-[#b0b8c1]" />
                    <span className="truncate">{ev.message}</span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {/* 4. 실패/스킵 사유 */}
        {progress.error ? (
          <div className="p-3 rounded-2xl bg-[#fef2f2] border border-[#f04452]/20 text-xs font-semibold text-[#f04452] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="min-w-0 break-words">{progress.error}</span>
          </div>
        ) : null}
        {status === "completed" && progress.summary ? (
          <div className="p-3 rounded-2xl bg-[#e6f8f0] border border-[#03b26c]/20 text-xs font-semibold text-[#03b26c] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              파이프라인이 완료됐어요 · 성공 {done}건
              {failed > 0 ? ` · 실패 ${failed}건` : ""}
            </span>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}