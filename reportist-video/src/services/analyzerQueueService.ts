// src/services/analyzerQueueService.ts
// 자체 인메모리 큐 & 워커 (reportist-analyzer) 연동 클라이언트

import type { ExtractedFrame } from '../types/video.ts';

export const DEFAULT_ANALYZER_QUEUE_URL =
  (import.meta.env.VITE_ANALYZER_QUEUE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://younginpiniti-coin-bridge.hf.space';

export type AnalyzerQueueJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface QueueJobStatusResponse {
  job_id: string;
  job_type: string;
  status: AnalyzerQueueJobStatus;
  priority: number;
  progress: number;
  progress_message?: string;
  reasoning_preview?: string;
  queue_position?: number;
  estimated_wait_sec?: number;
  elapsed_sec: number;
  result?: {
    videoName: string;
    videoDuration: number;
    analysis?: {
      videoTitle?: string;
      bestThumbnailTimestamp?: number;
      bestThumbnailReason?: string;
      rawText?: string;
      segments?: Array<{
        start: number;
        end: number;
        reason?: string;
        cropPosition?: 'top' | 'center' | 'bottom';
      }>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  error?: string;
}

export interface QueueJobUpdate {
  jobId: string;
  status: AnalyzerQueueJobStatus;
  queuePosition?: number;
  estimatedWaitSec?: number;
  progress: number;
  message?: string;
  reasoningPreview?: string;
}

export interface EnqueueVideoParams {
  videoName: string;
  videoDuration: number;
  frames: ExtractedFrame[];
  locale?: string;
  model?: string;
  prompt?: string;
  priority?: number;
  baseUrl?: string;
  signal?: AbortSignal;
}

export interface PollQueueOptions {
  jobId: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  signal?: AbortSignal;
  onQueueUpdate?: (info: QueueJobUpdate) => void;
  onActivity?: () => void;
}

export interface QueueAnalysisResult {
  job: QueueJobStatusResponse;
  analysis: NonNullable<NonNullable<QueueJobStatusResponse['result']>['analysis']> | null;
}

const ENQUEUE_TIMEOUT_MS = 12_000;
const STATUS_TIMEOUT_MS = 15_000;

/**
 * 환경 변수로 대기열 사용 여부를 제어합니다. 기본값은 사용입니다.
 * (VITE_ANALYZER_QUEUE_ENABLED=false 로 두면 기존 게이트웨이 직접 호출로 동작)
 */
export function isAnalyzerQueueEnabled(): boolean {
  const raw = import.meta.env.VITE_ANALYZER_QUEUE_ENABLED as string | undefined;
  if (raw === undefined) return true;
  return !['false', '0', 'off', 'no'].includes(raw.trim().toLowerCase());
}

function createAbortError(message = 'Analysis aborted by user'): DOMException {
  return new DOMException(message, 'AbortError');
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  parentSignal?: AbortSignal
): Promise<Response> {
  if (parentSignal?.aborted) {
    throw createAbortError();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);
  const onParentAbort = () => controller.abort(parentSignal?.reason);

  parentSignal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

/**
 * reportist-analyzer의 자체 큐에 비디오 분석 작업을 등록합니다.
 */
export async function enqueueVideoToAnalyzerQueue({
  videoName,
  videoDuration,
  frames,
  locale = 'ko',
  model,
  prompt,
  priority = 10,
  baseUrl = DEFAULT_ANALYZER_QUEUE_URL,
  signal,
}: EnqueueVideoParams): Promise<QueueJobStatusResponse> {
  const url = `${baseUrl}/api/queue/video/analyze`;

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoName,
        videoDuration,
        frames,
        locale,
        model,
        prompt,
        priority,
      }),
    },
    ENQUEUE_TIMEOUT_MS,
    signal
  );

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown server error');
    throw new Error(`[QueueService] 대기열 등록 실패 (${res.status}): ${errorText.slice(0, 300)}`);
  }

  return (await res.json()) as QueueJobStatusResponse;
}

/**
 * 대기열에 등록된 작업의 완료 여부를 폴링합니다.
 * - queued: 내 앞 대기자 수(queue_position)와 예상 대기 시간을 콜백으로 전달
 * - processing: 워커 진행률과 메시지를 콜백으로 전달
 * - 취소(AbortSignal) 시 서버에 취소를 통보한 뒤 AbortError를 던집니다.
 */
export async function pollVideoAnalysisFromQueue({
  jobId,
  baseUrl = DEFAULT_ANALYZER_QUEUE_URL,
  pollIntervalMs = 2000,
  signal,
  onQueueUpdate,
  onActivity,
}: PollQueueOptions): Promise<QueueAnalysisResult> {
  const statusUrl = `${baseUrl}/api/queue/jobs/${encodeURIComponent(jobId)}`;

  while (true) {
    if (signal?.aborted) {
      void cancelVideoAnalysisJob(jobId, baseUrl);
      throw createAbortError();
    }

    let job: QueueJobStatusResponse;
    try {
      const res = await fetchWithTimeout(statusUrl, { method: 'GET' }, STATUS_TIMEOUT_MS, signal);
      if (!res.ok) {
        throw new Error(`[QueueService] 작업 상태 조회 실패 (${res.status})`);
      }
      job = (await res.json()) as QueueJobStatusResponse;
    } catch (err) {
      if (signal?.aborted) {
        void cancelVideoAnalysisJob(jobId, baseUrl);
        throw createAbortError();
      }
      throw err;
    }

    onActivity?.();
    onQueueUpdate?.({
      jobId,
      status: job.status,
      queuePosition: job.queue_position,
      estimatedWaitSec: job.estimated_wait_sec,
      progress: job.progress || 0,
      message: job.progress_message,
      reasoningPreview: job.reasoning_preview,
    });

    if (job.status === 'completed') {
      return {
        job,
        analysis: job.result?.analysis ?? null,
      };
    }

    if (job.status === 'cancelled') {
      throw createAbortError('작업이 취소되었습니다.');
    }

    if (job.status === 'failed') {
      throw new Error(job.error || '워커에서 비디오 분석 중 오류가 발생했습니다.');
    }

    // 대기 중에는 서버 부하를 줄이기 위해 조금 더 느리게 폴링한다.
    const nextInterval = job.status === 'queued'
      ? Math.max(pollIntervalMs, 2500)
      : pollIntervalMs;
    await delay(nextInterval, signal);
  }
}

/**
 * 대기열에 등록된 작업을 취소합니다.
 */
export async function cancelVideoAnalysisJob(
  jobId: string,
  baseUrl = DEFAULT_ANALYZER_QUEUE_URL
): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/queue/jobs/${encodeURIComponent(jobId)}/cancel`,
      { method: 'POST', keepalive: true },
      8000
    );
    if (res.ok) {
      const data = (await res.json()) as { cancelled?: boolean };
      return Boolean(data.cancelled);
    }
  } catch (e) {
    console.warn('[QueueService] 작업 취소 요청 실패:', e);
  }
  return false;
}
