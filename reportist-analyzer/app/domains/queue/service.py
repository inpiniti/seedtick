"""
InMemoryQueueService: 외부 Redis 의존성 없는 완전 자체 인메모리 대기열 및 상태 관리
"""
import asyncio
import logging
import time
from typing import Any, Optional

from app.config.settings import settings
from app.domains.queue.models import JobItem, JobPriority, JobStatus

logger = logging.getLogger("queue_service")


class InMemoryQueueService:
    def __init__(
        self,
        default_ttl_sec: int = settings.QUEUE_JOB_TTL_SEC,
        max_retained_jobs: int = settings.QUEUE_MAX_JOBS,
    ):
        self.default_ttl_sec = default_ttl_sec
        self.max_retained_jobs = max_retained_jobs
        self._jobs: dict[str, JobItem] = {}
        self._queued_ids: list[str] = []
        self._lock = asyncio.Lock()
        self._notify_event = asyncio.Event()
        
        # 처리 통계 (예상 대기시간 계산용)
        self._total_processed: int = 0
        self._recent_durations: list[float] = []

    async def enqueue(
        self,
        job_type: str,
        payload: dict[str, Any],
        priority: int = JobPriority.NORMAL.value,
        custom_id: Optional[str] = None,
    ) -> JobItem:
        """대기열에 새 작업을 등록하고 즉시 반환한다."""
        async with self._lock:
            job = JobItem(
                job_id=custom_id or JobItem().job_id,
                job_type=job_type,
                payload=payload,
                priority=priority,
                status=JobStatus.QUEUED,
                created_at=time.time(),
            )
            self._jobs[job.job_id] = job
            self._insert_queued(job.job_id)
            self._notify_event.set()
            logger.info(f"[Queue] 작업 등록: {job.job_id} ({job.job_type}, 우선순위={job.priority})")
            return job

    def _insert_queued(self, job_id: str) -> None:
        """우선순위(내림차순), 생성시간(오름차순) 순으로 대기열에 삽입"""
        target = self._jobs[job_id]
        insert_idx = len(self._queued_ids)
        for i, qid in enumerate(self._queued_ids):
            other = self._jobs.get(qid)
            if not other:
                continue
            # 우선순위가 더 높으면 앞에 삽입
            if target.priority > other.priority:
                insert_idx = i
                break
            # 우선순위가 같으면 먼저 생성된 것이 앞
            elif target.priority == other.priority and target.created_at < other.created_at:
                insert_idx = i
                break
        self._queued_ids.insert(insert_idx, job_id)

    async def pop_next_job(self) -> Optional[JobItem]:
        """워커가 처리할 다음 작업을 대기열에서 꺼낸다. 취소된 작업은 자동으로 건너뛴다."""
        async with self._lock:
            while self._queued_ids:
                job_id = self._queued_ids.pop(0)
                job = self._jobs.get(job_id)
                if not job:
                    continue
                if job.status == JobStatus.CANCELLED or job.cancel_requested:
                    job.status = JobStatus.CANCELLED
                    job.finished_at = time.time()
                    continue
                
                job.status = JobStatus.PROCESSING
                job.started_at = time.time()
                return job
            return None

    async def wait_for_jobs(self, timeout: float = 1.0) -> None:
        """새 작업이 들어올 때까지 대기"""
        try:
            await asyncio.wait_for(self._notify_event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            pass
        finally:
            self._notify_event.clear()

    async def get_job(self, job_id: str) -> Optional[JobItem]:
        async with self._lock:
            return self._jobs.get(job_id)

    async def get_queue_position(self, job_id: str) -> Optional[int]:
        """내 앞 대기자 수 (0이면 다음 차례)"""
        async with self._lock:
            if job_id not in self._queued_ids:
                return None
            return self._queued_ids.index(job_id)

    def get_estimated_wait_sec(self, position: int, concurrency: int = 1) -> float:
        """내 앞 대기자 수와 최근 평균 소요 시간을 바탕으로 예상 대기 초 계산"""
        if position <= 0:
            return 0.0
        avg_duration = (
            sum(self._recent_durations) / len(self._recent_durations)
            if self._recent_durations
            else 8.0  # 기본 예상치: 약 8초
        )
        effective_concurrency = max(1, concurrency)
        return round((position * avg_duration) / effective_concurrency, 1)

    async def update_progress(
        self,
        job_id: str,
        progress: float,
        message: str = "",
        reasoning_preview: str | None = None,
    ) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.progress = max(0.0, min(100.0, progress))
                if message:
                    job.progress_message = message
                if reasoning_preview is not None:
                    job.reasoning_preview = reasoning_preview

    async def complete_job(self, job_id: str, result: Any) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = JobStatus.COMPLETED
                job.result = result
                job.progress = 100.0
                job.finished_at = time.time()
                if job.started_at:
                    duration = job.finished_at - job.started_at
                    self._recent_durations.append(duration)
                    if len(self._recent_durations) > 20:
                        self._recent_durations.pop(0)
                self._total_processed += 1
                logger.info(f"[Queue] 작업 완료: {job_id}")

    async def fail_job(self, job_id: str, error: str) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                job.status = JobStatus.FAILED
                job.error = error
                job.finished_at = time.time()
                logger.warning(f"[Queue] 작업 실패: {job_id} - {error}")

    async def cancel_job(self, job_id: str) -> bool:
        """대기열에 있거나 실행 중인 작업을 취소한다."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False

            job.cancel_requested = True
            if job.status == JobStatus.QUEUED:
                if job_id in self._queued_ids:
                    self._queued_ids.remove(job_id)
                job.status = JobStatus.CANCELLED
                job.finished_at = time.time()
                logger.info(f"[Queue] 대기열 작업 취소 완료: {job_id}")
                return True
            elif job.status == JobStatus.PROCESSING:
                logger.info(f"[Queue] 실행 중인 작업 취소 요청 플래그 설정: {job_id}")
                return True
            return False

    async def cleanup(self, max_age_sec: Optional[int] = None) -> int:
        """완료/실패/취소된 오래된 작업을 메모리에서 정리 (메모리 누수 방지)"""
        ttl = max_age_sec or self.default_ttl_sec
        now = time.time()
        removed = 0
        async with self._lock:
            # 1. 만료 시간 초과 항목 삭제
            expired_ids = [
                jid for jid, job in self._jobs.items()
                if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
                and job.finished_at
                and (now - job.finished_at) > ttl
            ]
            for jid in expired_ids:
                del self._jobs[jid]
                removed += 1

            # 2. 최대 개수 초과 시 가장 오래된 완료 항목부터 정리
            if len(self._jobs) > self.max_retained_jobs:
                completed_jobs = sorted(
                    [
                        job for job in self._jobs.values()
                        if job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
                    ],
                    key=lambda j: j.finished_at or 0.0,
                )
                overflow_count = len(self._jobs) - self.max_retained_jobs
                for job in completed_jobs[:overflow_count]:
                    if job.job_id in self._jobs:
                        del self._jobs[job.job_id]
                        removed += 1

        if removed > 0:
            logger.info(f"[Queue] 메모리 가비지 컬렉션: {removed}개 작업 정리 완료")
        return removed

    async def get_stats(self) -> dict[str, Any]:
        async with self._lock:
            queued_count = len(self._queued_ids)
            processing_count = sum(1 for j in self._jobs.values() if j.status == JobStatus.PROCESSING)
            completed_count = sum(1 for j in self._jobs.values() if j.status == JobStatus.COMPLETED)
            failed_count = sum(1 for j in self._jobs.values() if j.status == JobStatus.FAILED)
            cancelled_count = sum(1 for j in self._jobs.values() if j.status == JobStatus.CANCELLED)

            avg_duration = (
                sum(self._recent_durations) / len(self._recent_durations)
                if self._recent_durations
                else 0.0
            )

            return {
                "queued_jobs": queued_count,
                "processing_jobs": processing_count,
                "completed_jobs": completed_count,
                "failed_jobs": failed_count,
                "cancelled_jobs": cancelled_count,
                "total_in_memory": len(self._jobs),
                "total_processed_lifetime": self._total_processed,
                "recent_avg_processing_sec": round(avg_duration, 2),
            }


# 싱글톤 인스턴스
queue_service = InMemoryQueueService()
