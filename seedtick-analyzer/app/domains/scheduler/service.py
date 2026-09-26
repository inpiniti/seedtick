"""
SchedulerService: APScheduler 기반 일일 배치 등록 및 수동 트리거 지원
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.domains.scheduler.jobs import daily_pipeline_job, execute_pending_orders_job

logger = logging.getLogger("scheduler_service")


class SchedulerService:
    def __init__(self):
        self._scheduler = AsyncIOScheduler(timezone="Asia/Seoul")

    def start(self):
        """스케줄러 시작: 월~금 18:00 파이프라인 잡 및 22:35/23:35 정규장 예약 발주 잡 등록"""
        # 1. 일일 메인 파이프라인 잡: 월~금 18:00 KST
        pipeline_trigger = CronTrigger(
            day_of_week="mon-fri", hour=18, minute=0, timezone="Asia/Seoul"
        )
        self._scheduler.add_job(
            daily_pipeline_job,
            trigger=pipeline_trigger,
            id="daily_pipeline",
            name="SeedTick 일일 파이프라인 (스크리닝→13인리포트→예약매매)",
            replace_existing=True,
        )

        # 2. 미국 정규장 개장 후 예약 매수 자동 발주 잡: 월~금 22:35 KST(서머타임) 및 23:35 KST(표준시)
        summer_trigger = CronTrigger(
            day_of_week="mon-fri", hour=22, minute=35, timezone="Asia/Seoul"
        )
        self._scheduler.add_job(
            execute_pending_orders_job,
            trigger=summer_trigger,
            id="execute_pending_summer",
            name="미국 정규장 예약 매수 자동 발주 (서머타임: 22:35 KST)",
            replace_existing=True,
        )

        winter_trigger = CronTrigger(
            day_of_week="mon-fri", hour=23, minute=35, timezone="Asia/Seoul"
        )
        self._scheduler.add_job(
            execute_pending_orders_job,
            trigger=winter_trigger,
            id="execute_pending_winter",
            name="미국 정규장 예약 매수 자동 발주 (표준시: 23:35 KST)",
            replace_existing=True,
        )

        self._scheduler.start()
        logger.info("[Scheduler] APScheduler 시작 완료 (18:00 파이프라인, 22:35/23:35 예약 발주)")

    def shutdown(self):
        """스케줄러 안전 종료"""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("[Scheduler] APScheduler 종료 완료")

    async def trigger_pipeline(
        self, dry_run: bool | None = None, force: bool = False, max_count: int | None = None
    ) -> dict:
        """수동 즉시 트리거 (API 엔드포인트용)"""
        logger.info(f"[Scheduler] 수동 파이프라인 트리거 (dry_run={dry_run}, force={force}, max_count={max_count})")
        return await daily_pipeline_job(
            dry_run=dry_run, force=force, max_analyze_count=max_count
        )

    async def trigger_pending_orders(self, dry_run: bool | None = None) -> dict:
        """대기 중인 예약 주문 수동 즉시 발주 트리거"""
        logger.info(f"[Scheduler] 수동 예약 주문 발주 트리거 (dry_run={dry_run})")
        return await execute_pending_orders_job(dry_run=dry_run)


scheduler_service = SchedulerService()
