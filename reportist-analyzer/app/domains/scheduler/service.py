"""
SchedulerService: APScheduler 기반 일일 배치 등록 및 수동 트리거 지원
"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.domains.report.pipeline_progress import pipeline_progress
from app.domains.scheduler.jobs import (
    daily_pipeline_job,
    us_daily_pipeline_job,
    kr_daily_pipeline_job,
    cleanup_old_logs_job,
    reset_model_rotation_job,
)

logger = logging.getLogger("scheduler_service")


class SchedulerService:
    def __init__(self):
        self._scheduler = AsyncIOScheduler(timezone="Asia/Seoul")
        # 백그라운드로 시작된 파이프라인 태스크 참조 (GC 방지)
        self._background_tasks: set[asyncio.Task] = set()

    def start(self):
        """스케줄러 시작: 00:01 모델초기화, 08:00 로그정리, 09:00 미장파이프라인, 16:00 국장파이프라인 잡 등록"""
        # 0. AI 모델 순위 초기화 잡: 매일 00:01 KST
        # 1순위 모델의 프로바이더 과부하는 자정 지나면 자연 복구되므로 1순위로 되돌린다.
        # 정각(00:00)과 겹치지 않도록 1분 뒤로 두어 야간 배치 준비를 방해하지 않는다.
        model_reset_trigger = CronTrigger(hour=0, minute=1, timezone="Asia/Seoul")
        self._scheduler.add_job(
            reset_model_rotation_job,
            trigger=model_reset_trigger,
            id="reset_model_rotation",
            name="AI 모델 순위 1순위 초기화 (매일 00:01 KST)",
            replace_existing=True,
        )

        # 1. 일일 시스템 로그 정리 잡: 매일 08:00 KST (09:00 미국 파이프라인 1시간 전 실행)
        # 24시간 이전의 만료된 INFO 로그만 삭제하여 DB 용량 절약 (WARNING, ERROR, CRITICAL은 보존)
        cleanup_logs_trigger = CronTrigger(
            hour=8, minute=0, timezone="Asia/Seoul"
        )
        self._scheduler.add_job(
            cleanup_old_logs_job,
            trigger=cleanup_logs_trigger,
            id="cleanup_old_logs",
            name="일일 만료 INFO 시스템 로그 정리 (매일 오전 08:00)",
            replace_existing=True,
        )

        # 2. 미국 주식 일일 파이프라인 잡: 월~금 09:00 KST (미국 정규장 마감 후 분석)
        us_pipeline_trigger = CronTrigger(
            day_of_week="mon-fri", hour=9, minute=0, timezone="Asia/Seoul"
        )
        self._scheduler.add_job(
            us_daily_pipeline_job,
            trigger=us_pipeline_trigger,
            id="us_daily_pipeline",
            name="미국 주식 일일 파이프라인 (토스200+로마→13인리포트, 매일 09:00 KST)",
            replace_existing=True,
        )

        # 3. 국내 주식 일일 파이프라인 잡: 월~금 16:00 KST (한국 정규장 15:30 마감 후 분석)
        kr_pipeline_trigger = CronTrigger(
            day_of_week="mon-fri", hour=16, minute=0, timezone="Asia/Seoul"
        )
        self._scheduler.add_job(
            kr_daily_pipeline_job,
            trigger=kr_pipeline_trigger,
            id="kr_daily_pipeline",
            name="국내 주식 일일 파이프라인 (국장발굴→13인리포트, 매일 16:00 KST)",
            replace_existing=True,
        )

        self._scheduler.start()
        logger.info(
            "[Scheduler] APScheduler 시작 완료 (00:01 모델초기화, 08:00 로그정리, 09:00 미장파이프라인, 16:00 국장파이프라인)"
        )

    def shutdown(self):
        """스케줄러 안전 종료"""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("[Scheduler] APScheduler 종료 완료")

    async def trigger_pipeline(
        self,
        dry_run: bool | None = None,
        force: bool = False,
        max_count: int | None = None,
        skip_already_reported: bool = True,
        market: str = "all",
    ) -> dict:
        """수동 즉시 트리거 (API 엔드포인트용) - 파이프라인 완료까지 대기"""
        logger.info(
            f"[Scheduler] 수동 파이프라인 트리거 (dry_run={dry_run}, force={force}, market={market}, max_count={max_count}, skip_already_reported={skip_already_reported})"
        )
        return await daily_pipeline_job(
            dry_run=dry_run,
            force=force,
            max_analyze_count=max_count,
            skip_already_reported=skip_already_reported,
            market=market,
        )

    def start_pipeline_background(
        self,
        dry_run: bool | None = None,
        force: bool = False,
        max_count: int | None = None,
        skip_already_reported: bool = True,
        market: str = "all",
    ) -> dict:
        """
        수동 즉시 트리거 (관리자 화면용) - 즉시 응답하고 파이프라인은 백그라운드 실행.

        이미 실행 중이면 409 대신 skipped 를 반환하며, 화면은 /progress 폴링으로 확인합니다.
        """
        if pipeline_progress.is_running():
            logger.warning("[Scheduler] 이미 파이프라인이 실행 중입니다. 백그라운드 트리거 거부.")
            return {"status": "skipped", "reason": "already_running"}

        logger.info(
            f"[Scheduler] 백그라운드 파이프라인 트리거 (dry_run={dry_run}, force={force}, market={market}, max_count={max_count}, skip_already_reported={skip_already_reported})"
        )
        task = asyncio.create_task(
            daily_pipeline_job(
                dry_run=dry_run,
                force=force,
                max_analyze_count=max_count,
                skip_already_reported=skip_already_reported,
                market=market,
            )
        )
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)
        return {"status": "started", "reason": None, "market": market}


    def get_pipeline_progress(self) -> dict:
        """현재 파이프라인 진행 상태 스냅샷 (관리자 화면 폴링용)"""
        return pipeline_progress.snapshot()

    async def trigger_log_cleanup(self, hours: int = 24) -> dict:
        """만료 시스템 로그 수동 즉시 정리 트리거"""
        logger.info(f"[Scheduler] 수동 로그 정리 트리거 (hours={hours})")
        return await cleanup_old_logs_job(hours=hours)

    async def trigger_model_rotation_reset(self) -> dict:
        """AI 모델 순위 1순위 초기화 수동 트리거"""
        logger.info("[Scheduler] 수동 모델 순위 초기화 트리거")
        return await reset_model_rotation_job()


scheduler_service = SchedulerService()
