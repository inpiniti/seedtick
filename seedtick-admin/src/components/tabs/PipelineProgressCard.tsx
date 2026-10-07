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
import type { PipelineProgress, PipelineStageTiming } from "@/types/api";

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

function formatElapsedCompact(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** 실행 중 경과 시간을 1초 단위로 갱신하는 소형 컴포넌트 */
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
      <div className="p-4 rounded-md border border-[#e2e8f0] bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] flex items-center justify-center shrink-0">
              <Play className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#0f172a]">
                13인 거장 파이프라인 대기 중
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                {isLoading
                  ? "진행 상태를 확인하고 있습니다..."
                  : "파이프라인이 실행되면 실시간 분석 단계와 소요 시간이 표시됩니다."}
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 rounded border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer"
              title="진행 상태 수동 새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>
    );
  }

  const total = progress.total_tickers;
  const done = progress.completed_tickers;
  const failed = progress.failed_tickers;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const currentIdx = progress.stage_index;
  const showGurus = progress.gurus_total > 0;
  const stageTimings: PipelineStageTiming[] =
    progress.stage_timings && progress.stage_timings.length === progress.stages.length
      ? progress.stage_timings
      : progress.stages.map((stage, idx) => ({
          key: stage.key,
          label: stage.label,
          elapsed_seconds: 0,
          status:
            idx < currentIdx
              ? "done"
              : idx === currentIdx && isRunning
                ? "running"
                : idx === currentIdx && status === "failed"
                  ? "failed"
                  : "pending",
        }));
  const maxStageSeconds = Math.max(
    1,
    ...stageTimings.map((item) => Math.max(0, item.elapsed_seconds || 0))
  );

  return (
    <div
      className={`p-5 rounded-md border bg-white ${
        isRunning ? "border-blue-400 ring-1 ring-blue-100" : "border-[#e2e8f0]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <Activity
            className={`w-4 h-4 ${isRunning ? "text-blue-600 animate-pulse" : "text-[#64748b]"}`}
          />
          <span className="text-sm font-bold text-[#0f172a]">
            13인 거장 파이프라인 진행 상황
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="flex items-center gap-1 text-[11px] text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] px-2 py-0.5 rounded">
            <Clock className="w-3 h-3" />
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
              className="p-1 rounded border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-colors cursor-pointer"
              title="진행 상태 수동 새로고침"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        {/* 1. 전체 종목 진행률 */}
        <div className="p-3.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0]">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-xs font-mono text-[#64748b]">
                PROGRESS
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-[#0f172a] mt-0.5">
                <span className="text-blue-600">{done}</span>
                <span className="text-[#94a3b8] text-base font-normal"> / {total || "?"}</span>
                {failed > 0 ? (
                  <span className="ml-2 text-xs font-semibold text-rose-600">FAILED: {failed}</span>
                ) : null}
              </div>
            </div>
            <div className="text-right min-w-0 font-mono">
              {progress.current_ticker ? (
                <>
                  <div className="text-[11px] text-[#64748b]">CURRENT TICKER</div>
                  <div className="text-sm font-bold text-[#0f172a] truncate">
                    {progress.current_ticker_index > 0 ? `${progress.current_ticker_index}. ` : ""}
                    {progress.current_ticker}
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#64748b]">
                  {status === "running" ? "스크리닝 중..." : "종목 확정 대기"}
                </div>
              )}
            </div>
          </div>

          {/* 진행 바 */}
          <div className="mt-2.5 h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                status === "failed" ? "bg-rose-600" : "bg-blue-600"
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
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors ${
                  isActive ? "bg-blue-50/60 border border-blue-200" : ""
                }`}
              >
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[10px] font-semibold shrink-0 border ${
                    isFailed
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : isDone
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isActive
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-400 border-slate-200"
                  }`}
                >
                  {isFailed ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : isDone ? (
                    <Check className="w-3 h-3" />
                  ) : isActive ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span
                  className={`text-xs flex-1 min-w-0 truncate ${
                    isActive || isDone ? "font-medium text-[#0f172a]" : "text-[#64748b]"
                  }`}
                >
                  {stage.label}
                </span>
                {isSummaries && showGurus ? (
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded border shrink-0 ${
                      isActive
                        ? "bg-white text-blue-700 border-blue-200"
                        : "bg-slate-50 text-[#64748b] border-slate-200"
                    }`}
                  >
                    {progress.gurus_done}/{progress.gurus_total}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* 3. 단계별 소요 시간 비교 */}
        <div className="pt-2 border-t border-[#f1f5f9]">
          <div className="text-xs font-mono text-[#64748b] mb-2 uppercase">
            Stage Timings
          </div>
          <div className="space-y-1.5">
            {stageTimings.map((timing) => {
              const seconds = Math.max(0, timing.elapsed_seconds || 0);
              const width = Math.max(4, Math.round((seconds / maxStageSeconds) * 100));
              const barClass =
                timing.status === "failed"
                  ? "bg-rose-600"
                  : timing.status === "running"
                    ? "bg-blue-600"
                    : timing.status === "done"
                      ? "bg-emerald-600"
                      : "bg-slate-300";

              return (
                <div key={timing.key} className="grid grid-cols-[120px_1fr_auto] items-center gap-2 font-mono text-[11px]">
                  <span className="text-[#64748b] truncate">
                    {timing.label}
                  </span>
                  <div className="h-1.5 rounded-full bg-[#f1f5f9] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-[#334155] whitespace-nowrap">
                    {seconds > 0 ? formatElapsedCompact(seconds) : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. 최근 진행 이벤트 로그 */}
        {progress.events.length > 0 ? (
          <div className="pt-2 border-t border-[#f1f5f9]">
            <div className="text-xs font-mono text-[#64748b] mb-1.5 uppercase">
              Recent Events
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto font-mono text-[11px]">
              {progress.events
                .slice(-4)
                .reverse()
                .map((ev, i) => (
                  <div
                    key={`${ev.time}-${i}`}
                    className="flex items-start gap-1.5 text-[#64748b]"
                  >
                    <MinusCircle className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                    <span className="truncate">{ev.message}</span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        {/* 5. 실패/스킵 사유 */}
        {progress.error ? (
          <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-xs font-mono text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="min-w-0 break-words">{progress.error}</span>
          </div>
        ) : null}
        {status === "completed" && progress.summary ? (
          <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>
              파이프라인 완료 · 성공 {done}건
              {failed > 0 ? ` · 실패 ${failed}건` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}