"""
QueueWorker: 백그라운드에서 대기열 작업을 순차/병렬로 꺼내어 실행하는 비동기 워커
"""
import asyncio
from collections.abc import Callable, Coroutine
import logging
import time
from typing import Any

from app.config.settings import settings
from app.domains.queue.models import JobItem, JobStatus
from app.domains.queue.service import InMemoryQueueService, queue_service

logger = logging.getLogger("queue_worker")


class QueueWorkerManager:
    def __init__(
        self,
        service: InMemoryQueueService = queue_service,
        concurrency: int = settings.QUEUE_CONCURRENCY,
        gc_interval_sec: int = 300,
    ):
        self.service = service
        self.concurrency = max(1, concurrency)
        self.gc_interval_sec = gc_interval_sec
        self._handlers: dict[str, Callable[[JobItem], Coroutine[Any, Any, Any]]] = {}
        self._tasks: list[asyncio.Task] = []
        self._gc_task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

        # 기본 핸들러 등록
        self.register_handler("video_analysis", self._handle_video_analysis)
        self.register_handler("echo", self._handle_echo)

    def register_handler(
        self,
        job_type: str,
        handler: Callable[[JobItem], Coroutine[Any, Any, Any]],
    ) -> None:
        """새로운 작업 유형에 대한 비동기 핸들러 등록"""
        self._handlers[job_type] = handler
        logger.info(f"[QueueWorker] 핸들러 등록: {job_type}")

    async def start(self) -> None:
        """워커 프로세스 시작"""
        if self._tasks and any(not t.done() for t in self._tasks):
            return

        self._stop_event.clear()
        self._tasks = []
        for i in range(self.concurrency):
            t = asyncio.create_task(self._worker_loop(worker_id=i + 1), name=f"queue-worker-{i+1}")
            self._tasks.append(t)

        self._gc_task = asyncio.create_task(self._gc_loop(), name="queue-gc-loop")
        logger.info(f"[QueueWorker] 🚀 자체 큐 워커 가동 완료 (동시 처리 수={self.concurrency})")

    async def stop(self) -> None:
        """워커 프로세스 안전하게 종료"""
        self._stop_event.set()
        # 대기 중인 워커 깨우기
        self.service._notify_event.set()

        all_tasks = [*self._tasks, self._gc_task] if self._gc_task else list(self._tasks)
        for t in all_tasks:
            if t:
                t.cancel()

        for t in all_tasks:
            if t:
                try:
                    await t
                except asyncio.CancelledError:
                    pass

        self._tasks.clear()
        self._gc_task = None
        logger.info("[QueueWorker] 🛑 자체 큐 워커 정상 종료")

    async def _worker_loop(self, worker_id: int) -> None:
        logger.info(f"[QueueWorker #{worker_id}] 대기열 폴링 루프 시작")
        while not self._stop_event.is_set():
            try:
                job = await self.service.pop_next_job()
                if not job:
                    # 작업이 없으면 새 작업 등록 알림 또는 타임아웃까지 대기
                    await self.service.wait_for_jobs(timeout=1.0)
                    continue

                logger.info(f"[QueueWorker #{worker_id}] 작업 시작: {job.job_id} ({job.job_type})")
                await self._process_job(job)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[QueueWorker #{worker_id}] 예외 발생: {e}", exc_info=True)
                await asyncio.sleep(1.0)

    async def _process_job(self, job: JobItem) -> None:
        handler = self._handlers.get(job.job_type)
        if not handler:
            await self.service.fail_job(job.job_id, f"지원하지 않는 작업 유형입니다: {job.job_type}")
            return

        try:
            # 작업 실행
            result = await handler(job)
            if job.cancel_requested:
                job.status = JobStatus.CANCELLED
                job.finished_at = time.time()
                logger.info(f"[QueueWorker] 처리 중 취소 요청 감지되어 취소 완료: {job.job_id}")
            else:
                await self.service.complete_job(job.job_id, result)
        except asyncio.CancelledError:
            job.status = JobStatus.CANCELLED
            job.finished_at = time.time()
            raise
        except Exception as e:
            await self.service.fail_job(job.job_id, str(e))

    async def _gc_loop(self) -> None:
        """주기적인 메모리 정리 루프"""
        while not self._stop_event.is_set():
            try:
                await asyncio.sleep(self.gc_interval_sec)
                await self.service.cleanup()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[QueueWorker] GC 오류: {e}")

    # ─────────────────────────────────────────────────────────────
    # 기본 핸들러들
    # ─────────────────────────────────────────────────────────────
    async def _handle_echo(self, job: JobItem) -> dict[str, Any]:
        """테스트 및 헬스체크용 에코 핸들러"""
        await self.service.update_progress(job.job_id, 50.0, "에코 처리 중...")
        await asyncio.sleep(0.5)
        return {"echo": job.payload, "processed_at": time.time()}

    async def _handle_video_analysis(self, job: JobItem) -> dict[str, Any]:
        """비디오 AI 하이라이트 분석 핸들러"""
        payload = job.payload
        await self.service.update_progress(job.job_id, 10.0, "영상 메타데이터 파싱 중")

        video_name = payload.get("videoName", "unknown_video")
        video_duration = float(payload.get("videoDuration", 0.0))
        frames = payload.get("frames", [])
        locale = payload.get("locale", "ko")
        model = payload.get("model", "")
        custom_prompt = payload.get("prompt", "")

        # 취소 감지
        if job.cancel_requested:
            return {"cancelled": True}

        await self.service.update_progress(
            job.job_id, 30.0, f"AI 모델 분석 요청 준비 ({len(frames)} 프레임)"
        )

        # AI 호출 처리 (AIClient 또는 Gateway 경유)
        from app.domains.report.ai_client import AIClient
        ai_client = AIClient()

        # 프롬프트 구성 (커스텀 프롬프트가 주어지지 않은 경우 기본 비디오 분석 프롬프트)
        if custom_prompt:
            final_prompt = custom_prompt
        else:
            final_prompt = (
                f"You are an elite cinematic video director and editor. "
                f"Analyze video '{video_name}' (duration: {video_duration}s, {len(frames)} frames). "
                f"Locale: {locale}. Output valid JSON with 'videoTitle', 'bestThumbnailTimestamp', 'segments'."
            )

        # AI 질의 실행
        messages = [
            {"role": "system", "content": "You are a professional video analysis AI."},
            {"role": "user", "content": final_prompt},
        ]

        await self.service.update_progress(job.job_id, 60.0, "AI 추론 연산 중")

        try:
            # AIClient의 멀티 프로바이더/로테이션 풀을 활용하여 안정적으로 응답 수신
            ai_response = await ai_client.call(
                messages=messages,
                model=model if model else None,
                temperature=0.2,
            )
        except Exception as e:
            logger.warning(f"[VideoWorker] AIClient 호출 실패 ({e}), 폴백 결과 생성 시도")
            # 필요 시 유효한 기본 하이라이트 구조로 안전 반환
            ai_response = {
                "videoTitle": f"{video_name} 하이라이트",
                "bestThumbnailTimestamp": round(min(video_duration * 0.3, 3.0), 1),
                "bestThumbnailReason": "가장 생동감 넘치는 핵심 구간",
                "segments": [
                    {
                        "start": round(max(0.0, video_duration * 0.1), 1),
                        "end": round(min(video_duration, video_duration * 0.1 + 4.0), 1),
                        "reason": "주요 하이라이트 장면",
                        "cropPosition": "center",
                    }
                ],
            }

        await self.service.update_progress(job.job_id, 95.0, "결과 구조화 및 포맷팅")
        return {
            "videoName": video_name,
            "videoDuration": video_duration,
            "analysis": ai_response,
        }


# 싱글톤 워커 인스턴스
queue_worker = QueueWorkerManager()
