"""
SchedulerService: APScheduler 기반 일일 배치 등록 및 수동 트리거 지원
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.domains.scheduler.jobs import daily_pipeline_job

logger = logging.getLogger("scheduler_service")


class SchedulerService:
    def __init__(self):
        self._scheduler = AsyncIOScheduler(timezone="Asia/Seoul")

    def start(self):
        """스케줄러 시작: 월~금 18:00 KST 잡 등록"""
        # Cron: 월~금(mon-fri) 18시 00분
        trigger = CronTrigger(
            day_of_week="mon-fri", hour=18, minute=0, timezone="Asia/Seoul"
        )
        self._scheduler.add_job(
            daily_pipeline_job,
            trigger=trigger,
            id="daily_pipeline",
            name="SeedTick 일일 파이프라인 (스크리닝→13인리포트→매매)",
            replace_existing=True,
        )
        self._scheduler.start()
        logger.info("[Scheduler] APScheduler 시작 완료 (매일 월~금 18:00 KST)")

    def shutdown(self):
        """스케줄러 안전 종료"""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("[Scheduler] APScheduler 종료 완료")

    async def trigger_pipeline(
        self, dry_run: bool | None = None, force: bool = False, max_count: int = 5
    ) -> dict:
        """수동 즉시 트리거 (API 엔드포인트용)"""
        logger.info(f"[Scheduler] 수동 파이프라인 트리거 (dry_run={dry_run}, force={force})")
        return await daily_pipeline_job(
            dry_run=dry_run, force=force, max_analyze_count=max_count
        )


scheduler_service = SchedulerService()
