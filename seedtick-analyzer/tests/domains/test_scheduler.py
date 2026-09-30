"""
Scheduler Service & Timezone 단위 테스트
"""
import zoneinfo
from datetime import datetime
from apscheduler.triggers.cron import CronTrigger
from app.domains.scheduler.service import SchedulerService


def test_us_market_open_trigger_dst_and_standard():
    trigger = CronTrigger(
        day_of_week="mon-fri", hour=9, minute=35, timezone="America/New_York"
    )

    # 1. 서머타임 (예: 2026년 9월 29일 화요일) -> KST 22:35 확인
    summer_dt = datetime(2026, 9, 29, 0, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
    next_summer = trigger.get_next_fire_time(None, summer_dt)
    assert next_summer is not None
    next_summer_kst = next_summer.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
    assert next_summer_kst.hour == 22
    assert next_summer_kst.minute == 35

    # 2. 겨울철 표준시 (예: 2026년 12월 1일 화요일) -> KST 23:35 확인
    winter_dt = datetime(2026, 12, 1, 0, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
    next_winter = trigger.get_next_fire_time(None, winter_dt)
    assert next_winter is not None
    next_winter_kst = next_winter.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
    assert next_winter_kst.hour == 23
    assert next_winter_kst.minute == 35


import pytest


@pytest.mark.asyncio
async def test_scheduler_jobs_registration():
    service = SchedulerService()
    service.start()
    try:
        jobs = {job.id: job for job in service._scheduler.get_jobs()}
        assert "daily_pipeline" in jobs
        assert "execute_pending_orders" in jobs
        # 기존 중복 잡(summer, winter)이 단일 잡으로 통합되었는지 검증
        assert "execute_pending_summer" not in jobs
        assert "execute_pending_winter" not in jobs

        # 일일 파이프라인 트리거가 12:00 KST에 실행되는지 검증
        pipeline_job = jobs["daily_pipeline"]
        pipeline_trigger = pipeline_job.trigger
        assert isinstance(pipeline_trigger, CronTrigger)
        test_dt = datetime(2026, 9, 30, 0, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        next_fire = pipeline_trigger.get_next_fire_time(None, test_dt)
        assert next_fire is not None
        next_fire_kst = next_fire.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
        assert next_fire_kst.hour == 12
        assert next_fire_kst.minute == 0
    finally:
        service.shutdown()

