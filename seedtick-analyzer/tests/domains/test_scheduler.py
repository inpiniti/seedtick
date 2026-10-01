"""
Scheduler Service & Timezone 단위 테스트
"""
import asyncio
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
        assert "cleanup_old_logs" in jobs
        assert "daily_pipeline" in jobs
        assert "execute_pending_orders" in jobs
        # 기존 중복 잡(summer, winter)이 단일 잡으로 통합되었는지 검증
        assert "execute_pending_summer" not in jobs
        assert "execute_pending_winter" not in jobs

        # 1. 만료 로그 정리 트리거가 11:00 KST에 실행되는지 검증
        cleanup_job = jobs["cleanup_old_logs"]
        cleanup_trigger = cleanup_job.trigger
        assert isinstance(cleanup_trigger, CronTrigger)
        test_dt = datetime(2026, 9, 30, 0, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        next_cleanup = cleanup_trigger.get_next_fire_time(None, test_dt)
        assert next_cleanup is not None
        next_cleanup_kst = next_cleanup.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
        assert next_cleanup_kst.hour == 11
        assert next_cleanup_kst.minute == 0

        # 2. 일일 파이프라인 트리거가 12:00 KST에 실행되는지 검증
        pipeline_job = jobs["daily_pipeline"]
        pipeline_trigger = pipeline_job.trigger
        assert isinstance(pipeline_trigger, CronTrigger)
        next_fire = pipeline_trigger.get_next_fire_time(None, test_dt)
        assert next_fire is not None
        next_fire_kst = next_fire.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
        assert next_fire_kst.hour == 12
        assert next_fire_kst.minute == 0
    finally:
        service.shutdown()


@pytest.mark.asyncio
async def test_cleanup_old_logs_job_mock(monkeypatch):
    """로그 정리 잡 실행 시 delete_old_info_logs 호출 검증"""
    from app.domains.scheduler.jobs import cleanup_old_logs_job
    from app.infrastructure.supabase_repo import supabase_repo

    called_with = []

    def mock_delete(hours: int = 24):
        called_with.append(hours)
        return 42

    monkeypatch.setattr(supabase_repo, "delete_old_info_logs", mock_delete)

    result = await cleanup_old_logs_job(hours=24)
    assert result["status"] == "success"
    assert result["deleted_count"] == 42
    assert result["hours"] == 24
    assert called_with == [24]


@pytest.mark.asyncio
async def test_daily_pipeline_skip_already_reported(monkeypatch):
    """오늘 이미 리포트가 등록된 종목은 제외하고 분석하는지 검증"""
    from app.domains.scheduler.jobs import daily_pipeline_job
    from app.domains.scheduler.market_guard import MarketCalendarGuard
    from app.domains.screener.service import ScreenerService
    from app.domains.screener.models import ScreenResult, TossStockItem, ScreenCriteria
    from app.domains.report.service import GuruReportService
    from app.infrastructure.supabase_repo import supabase_repo

    # 1. 휴장일 가드: 개장 상태
    monkeypatch.setattr(MarketCalendarGuard, "is_market_open", lambda self, d: (True, "정규장"))

    # 2. 스크리너 mock (AAPL, NVDA, MSFT 3종목)
    async def mock_get_stock_list(self):
        items = [
            TossStockItem(ticker="AAPL", stock_code="US1", name="Apple", screeners=["공통"]),
            TossStockItem(ticker="NVDA", stock_code="US2", name="Nvidia", screeners=["공통"]),
            TossStockItem(ticker="MSFT", stock_code="US3", name="Microsoft", screeners=["공통"]),
        ]
        return ScreenResult(
            tickers=items,
            items=items,
            total_count=3,
            count=3,
            criteria=ScreenCriteria(),
        )
    monkeypatch.setattr(ScreenerService, "get_stock_list", mock_get_stock_list)

    # 3. Supabase: AAPL은 이미 등록됨
    monkeypatch.setattr(supabase_repo, "get_reported_tickers_for_date", lambda d: {"AAPL"})

    # 4. Report service mock
    analyzed_tickers = []
    async def mock_generate_full_report(self, ticker, target_date, screeners=None):
        analyzed_tickers.append(ticker)
        class DummyReport:
            pass
        return DummyReport()
    monkeypatch.setattr(GuruReportService, "generate_full_report", mock_generate_full_report)

    # 5. Discord notifier 알림 mock
    from app.domains.error_log.notifiers.discord import DiscordNotifier
    monkeypatch.setattr(DiscordNotifier, "notify_pipeline_summary", lambda *a, **k: asyncio.sleep(0))

    # 실행
    result = await daily_pipeline_job(skip_already_reported=True, force=True)

    assert result["status"] == "success"
    assert result["skipped_already_reported_count"] == 1
    assert result["skipped_already_reported_tickers"] == ["AAPL"]
    # AAPL은 제외되고 NVDA, MSFT만 분석됨
    assert analyzed_tickers == ["NVDA", "MSFT"]
    assert result["reported_count"] == 2



