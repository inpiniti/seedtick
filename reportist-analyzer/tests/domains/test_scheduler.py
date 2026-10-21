"""
Scheduler Service & Timezone 단위 테스트
"""
import asyncio
import zoneinfo
from datetime import datetime
from apscheduler.triggers.cron import CronTrigger
from app.domains.scheduler.service import SchedulerService


import pytest


@pytest.mark.asyncio
async def test_scheduler_jobs_registration():
    service = SchedulerService()
    service.start()
    try:
        jobs = {job.id: job for job in service._scheduler.get_jobs()}
        assert "cleanup_old_logs" in jobs
        assert "daily_outcome_tracking" in jobs
        assert "us_daily_pipeline" in jobs
        assert "kr_daily_pipeline" in jobs
        assert "reset_model_rotation" in jobs
        # 장외 예약 주문은 폐기됨: 정규장 개장 후 예약 발주 잡이 등록되지 않는다
        assert "execute_pending_orders" not in jobs

        # 0-1. 일일 성과 추적 잡이 08:30 KST에 실행되는지 검증
        outcome_job = jobs["daily_outcome_tracking"]
        outcome_trigger = outcome_job.trigger
        assert isinstance(outcome_trigger, CronTrigger)
        test_dt = datetime(2026, 9, 30, 0, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        next_outcome = outcome_trigger.get_next_fire_time(None, test_dt)
        assert next_outcome is not None
        next_outcome_kst = next_outcome.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
        assert next_outcome_kst.hour == 8
        assert next_outcome_kst.minute == 30

        # 1. 만료 로그 정리 트리거가 08:00 KST에 실행되는지 검증
        cleanup_job = jobs["cleanup_old_logs"]
        cleanup_trigger = cleanup_job.trigger
        assert isinstance(cleanup_trigger, CronTrigger)
        test_dt = datetime(2026, 9, 30, 0, 0, tzinfo=zoneinfo.ZoneInfo("Asia/Seoul"))
        next_cleanup = cleanup_trigger.get_next_fire_time(None, test_dt)
        assert next_cleanup is not None
        next_cleanup_kst = next_cleanup.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
        assert next_cleanup_kst.hour == 8
        assert next_cleanup_kst.minute == 0

        # 2. 미국 파이프라인 트리거가 09:00 KST에 실행되는지 검증
        us_job = jobs["us_daily_pipeline"]
        us_trigger = us_job.trigger
        assert isinstance(us_trigger, CronTrigger)
        next_us = us_trigger.get_next_fire_time(None, test_dt)
        assert next_us is not None
        next_us_kst = next_us.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
        assert next_us_kst.hour == 9
        assert next_us_kst.minute == 0

        # 3. 한국 파이프라인 트리거가 16:00 KST에 실행되는지 검증
        kr_job = jobs["kr_daily_pipeline"]
        kr_trigger = kr_job.trigger
        assert isinstance(kr_trigger, CronTrigger)
        next_kr = kr_trigger.get_next_fire_time(None, test_dt)
        assert next_kr is not None
        next_kr_kst = next_kr.astimezone(zoneinfo.ZoneInfo("Asia/Seoul"))
        assert next_kr_kst.hour == 16
        assert next_kr_kst.minute == 0
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
    async def mock_get_stock_list(self, criteria=None):
        if criteria and criteria.nation == "kr":
            return ScreenResult(tickers=[], items=[], total_count=0, count=0, criteria=criteria)
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
            criteria=criteria or ScreenCriteria(),
        )
    monkeypatch.setattr(ScreenerService, "get_stock_list", mock_get_stock_list)


    # 2-2. DataRoma(두번째 스크리너) mock — 외부 네트워크 호출 차단
    from app.domains.screener.roma_service import RomaScreenerService

    async def mock_roma_fail(self, min_holders=10, size=0):
        raise RuntimeError("test: dataroma disabled")
    monkeypatch.setattr(RomaScreenerService, "get_stock_list", mock_roma_fail)

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


@pytest.mark.asyncio
async def test_daily_pipeline_merges_roma_tickers(monkeypatch):
    """
    두번째 스크리너(DataRoma) 병합 검증:
    - 토스 통과 종목 + roma 전용 종목이 중복 없이 하나의 분석 대상으로 합쳐짐
    - 토스/roma 양쪽에 모두 있는 종목은 screeners 라벨만 'roma'로 병합
    """
    from app.domains.scheduler.jobs import daily_pipeline_job
    from app.domains.scheduler.market_guard import MarketCalendarGuard
    from app.domains.screener.service import ScreenerService
    from app.domains.screener.roma_service import RomaScreenerService
    from app.domains.screener.models import ScreenResult, TossStockItem, ScreenCriteria
    from app.domains.report.service import GuruReportService
    from app.domains.error_log.notifiers.discord import DiscordNotifier
    from app.infrastructure.supabase_repo import supabase_repo

    monkeypatch.setattr(MarketCalendarGuard, "is_market_open", lambda self, d: (True, "정규장"))

    # 1. 토스 스크리너: AAPL, NVDA
    async def mock_get_stock_list(self, criteria=None):
        if criteria and criteria.nation == "kr":
            return ScreenResult(tickers=[], items=[], total_count=0, count=0, criteria=criteria)
        items = [
            TossStockItem(ticker="AAPL", stock_code="US1", name="Apple", screeners=["공통"]),
            TossStockItem(ticker="NVDA", stock_code="US2", name="Nvidia", screeners=["공통"]),
        ]
        return ScreenResult(
            tickers=items, items=items, total_count=2, count=2, criteria=criteria or ScreenCriteria()
        )
    monkeypatch.setattr(ScreenerService, "get_stock_list", mock_get_stock_list)


    # 2. DataRoma 스크리너: AAPL(중복) + BRK.B(신규)
    async def mock_roma_list(self, min_holders=10, size=0):
        items = [
            TossStockItem(
                ticker="AAPL", stock_code="AAPL", name="Apple Inc.",
                screeners=["roma"], holders=22,
            ),
            TossStockItem(
                ticker="BRK.B", stock_code="BRK.B", name="Berkshire Hathaway CL B",
                screeners=["roma"], holders=26,
            ),
        ]
        return ScreenResult(
            tickers=items, items=items, total_count=2, count=2,
            criteria=ScreenCriteria(preset="roma"),
            source="dataroma_grand_portfolio",
        )
    monkeypatch.setattr(RomaScreenerService, "get_stock_list", mock_roma_list)

    monkeypatch.setattr(supabase_repo, "get_reported_tickers_for_date", lambda d: set())

    analyzed: dict[str, list[str] | None] = {}

    async def mock_generate_full_report(self, ticker, target_date, screeners=None):
        analyzed[ticker] = screeners

        class DummyReport:
            overall_verdict = "관망"

        return DummyReport()
    monkeypatch.setattr(GuruReportService, "generate_full_report", mock_generate_full_report)
    monkeypatch.setattr(
        DiscordNotifier, "notify_pipeline_summary", lambda *a, **k: asyncio.sleep(0)
    )

    result = await daily_pipeline_job(skip_already_reported=True, force=True)

    assert result["status"] == "success"
    # 중복 제거: AAPL은 한 번만, roma 신규 종목(BRK.B)은 뒤에 편입
    assert list(analyzed.keys()) == ["AAPL", "NVDA", "BRK.B"]
    # 스크리너 라벨 병합
    assert analyzed["AAPL"] == ["공통", "roma"]
    assert analyzed["NVDA"] == ["공통"]
    assert analyzed["BRK.B"] == ["roma"]
    # 집계
    assert result["screened_count"] == 3
    assert result["toss_screened_count"] == 2
    assert result["roma_screened_count"] == 2
    assert result["roma_added_count"] == 1
    assert result["reported_count"] == 3


@pytest.mark.asyncio
async def test_daily_pipeline_survives_roma_failure(monkeypatch):
    """DataRoma 조회 실패 시에도 토스 스크리닝만으로 파이프라인이 정상 완료되는지 검증"""
    from app.domains.scheduler.jobs import daily_pipeline_job
    from app.domains.scheduler.market_guard import MarketCalendarGuard
    from app.domains.screener.service import ScreenerService
    from app.domains.screener.roma_service import RomaScreenerService
    from app.domains.screener.models import ScreenResult, TossStockItem, ScreenCriteria
    from app.domains.report.service import GuruReportService
    from app.domains.error_log.notifiers.discord import DiscordNotifier
    from app.infrastructure.supabase_repo import supabase_repo

    monkeypatch.setattr(MarketCalendarGuard, "is_market_open", lambda self, d: (True, "정규장"))

    async def mock_get_stock_list(self, criteria=None):
        if criteria and criteria.nation == "kr":
            return ScreenResult(tickers=[], items=[], total_count=0, count=0, criteria=criteria)
        items = [TossStockItem(ticker="MSFT", stock_code="US3", name="Microsoft", screeners=["공통"])]
        return ScreenResult(
            tickers=items, items=items, total_count=1, count=1, criteria=criteria or ScreenCriteria()
        )
    monkeypatch.setattr(ScreenerService, "get_stock_list", mock_get_stock_list)


    async def mock_roma_fail(self, min_holders=10, size=0):
        raise RuntimeError("dataroma down")
    monkeypatch.setattr(RomaScreenerService, "get_stock_list", mock_roma_fail)

    monkeypatch.setattr(supabase_repo, "get_reported_tickers_for_date", lambda d: set())

    analyzed_tickers = []

    async def mock_generate_full_report(self, ticker, target_date, screeners=None):
        analyzed_tickers.append(ticker)

        class DummyReport:
            overall_verdict = "관망"

        return DummyReport()
    monkeypatch.setattr(GuruReportService, "generate_full_report", mock_generate_full_report)
    monkeypatch.setattr(
        DiscordNotifier, "notify_pipeline_summary", lambda *a, **k: asyncio.sleep(0)
    )

    result = await daily_pipeline_job(skip_already_reported=True, force=True)

    assert result["status"] == "success"
    assert analyzed_tickers == ["MSFT"]
    assert result["roma_screened_count"] == 0
    assert result["roma_added_count"] == 0


@pytest.mark.asyncio
async def test_us_and_kr_pipelines_separate(monkeypatch):
    """
    미국 파이프라인(us)과 한국 파이프라인(kr)이 각각 독립적인 스크리너와 종목만 분석하는지 검증
    """
    from app.domains.scheduler.jobs import us_daily_pipeline_job, kr_daily_pipeline_job
    from app.domains.scheduler.market_guard import MarketCalendarGuard
    from app.domains.screener.service import ScreenerService
    from app.domains.screener.roma_service import RomaScreenerService
    from app.domains.screener.models import ScreenResult, TossStockItem, ScreenCriteria
    from app.domains.report.service import GuruReportService
    from app.domains.error_log.notifiers.discord import DiscordNotifier
    from app.infrastructure.supabase_repo import supabase_repo

    monkeypatch.setattr(MarketCalendarGuard, "is_us_market_open", lambda self, d: (True, "정규장"))
    monkeypatch.setattr(MarketCalendarGuard, "is_kr_market_open", lambda self, d: (True, "정규장"))

    async def mock_screener(self, criteria=None):
        if criteria and criteria.nation == "kr":
            items = [TossStockItem(ticker="005930", stock_code="005930", name="삼성전자", screeners=["국장공통"])]
        else:
            items = [TossStockItem(ticker="AAPL", stock_code="AAPL", name="Apple", screeners=["공통"])]
        return ScreenResult(tickers=items, items=items, total_count=1, count=1, criteria=criteria or ScreenCriteria())

    monkeypatch.setattr(ScreenerService, "get_stock_list", mock_screener)

    async def mock_roma(self, min_holders=10, size=0):
        return ScreenResult(tickers=[], items=[], total_count=0, count=0, criteria=ScreenCriteria())

    monkeypatch.setattr(RomaScreenerService, "get_stock_list", mock_roma)
    monkeypatch.setattr(supabase_repo, "get_reported_tickers_for_date", lambda d: set())
    monkeypatch.setattr(DiscordNotifier, "notify_pipeline_summary", lambda *a, **k: asyncio.sleep(0))

    analyzed_tickers = []

    async def mock_gen_report(self, ticker, target_date, screeners=None):
        analyzed_tickers.append(ticker)
        class DummyReport:
            overall_verdict = "관망"
        return DummyReport()

    monkeypatch.setattr(GuruReportService, "generate_full_report", mock_gen_report)

    # 1. 미국 파이프라인 실행: AAPL만 분석되어야 함
    analyzed_tickers.clear()
    us_res = await us_daily_pipeline_job(force=True)
    assert us_res["status"] == "success"
    assert us_res["market"] == "us"
    assert analyzed_tickers == ["AAPL"]

    # 2. 한국 파이프라인 실행: 005930만 분석되어야 함
    analyzed_tickers.clear()
    kr_res = await kr_daily_pipeline_job(force=True)
    assert kr_res["status"] == "success"
    assert kr_res["market"] == "kr"
    assert analyzed_tickers == ["005930"]


@pytest.mark.asyncio
async def test_daily_pipeline_concurrent_ticker_execution(monkeypatch):
    """
    종목 단위 병렬 처리 검증:
    - 4개 종목을 처리할 때 REPORT_TICKER_CONCURRENCY(기본 2) 한도 내에서
      동시에 여러 종목이 병렬 실행되는지 검증
    """
    from app.domains.scheduler.jobs import daily_pipeline_job
    from app.domains.scheduler.market_guard import MarketCalendarGuard
    from app.domains.screener.service import ScreenerService
    from app.domains.screener.roma_service import RomaScreenerService
    from app.domains.screener.models import ScreenResult, TossStockItem, ScreenCriteria
    from app.domains.report.service import GuruReportService
    from app.domains.error_log.notifiers.discord import DiscordNotifier
    from app.infrastructure.supabase_repo import supabase_repo
    from app.config.settings import settings

    monkeypatch.setattr(MarketCalendarGuard, "is_us_market_open", lambda self, d: (True, "정규장"))
    monkeypatch.setattr(MarketCalendarGuard, "is_kr_market_open", lambda self, d: (False, "휴장"))

    tickers = ["AAPL", "NVDA", "MSFT", "GOOG"]
    items = [
        TossStockItem(ticker=t, stock_code=t, name=t, screeners=["공통"])
        for t in tickers
    ]

    async def mock_screener(self, criteria=None):
        return ScreenResult(tickers=items, items=items, total_count=4, count=4, criteria=criteria or ScreenCriteria())

    async def mock_roma(self, min_holders=10, size=0):
        return ScreenResult(tickers=[], items=[], total_count=0, count=0, criteria=ScreenCriteria())

    monkeypatch.setattr(ScreenerService, "get_stock_list", mock_screener)
    monkeypatch.setattr(RomaScreenerService, "get_stock_list", mock_roma)
    monkeypatch.setattr(supabase_repo, "get_reported_tickers_for_date", lambda d: set())
    monkeypatch.setattr(DiscordNotifier, "notify_pipeline_summary", lambda *a, **k: asyncio.sleep(0))

    active_count = 0
    max_active_observed = 0
    lock = asyncio.Lock()
    completed = []

    async def mock_gen_report(self, ticker, target_date, screeners=None):
        nonlocal active_count, max_active_observed
        async with lock:
            active_count += 1
            if active_count > max_active_observed:
                max_active_observed = active_count

        # 병렬성 확인을 위해 잠시 대기
        await asyncio.sleep(0.05)

        async with lock:
            active_count -= 1
            completed.append(ticker)

        class DummyReport:
            overall_verdict = "매수"
        return DummyReport()

    monkeypatch.setattr(GuruReportService, "generate_full_report", mock_gen_report)

    result = await daily_pipeline_job(force=True, market="us")

    assert result["status"] == "success"
    assert result["reported_count"] == 4
    # 세마포어(2)에 의해 동시에 최대 2개 종목만 병렬 실행됨
    expected_limit = max(1, settings.REPORT_TICKER_CONCURRENCY)
    assert max_active_observed == expected_limit
    assert set(completed) == set(tickers)


@pytest.mark.asyncio
async def test_kr_pipeline_waits_for_us_pipeline_to_complete(monkeypatch):
    """
    미장(US) 파이프라인이 아직 실행 중일 때 국장(KR) 파이프라인이 시작되면,
    스킵되지 않고 미장 완료를 대기한 후 순차적으로 정상 실행되는지 검증
    """
    from app.domains.scheduler.jobs import us_daily_pipeline_job, kr_daily_pipeline_job
    from app.domains.scheduler.market_guard import MarketCalendarGuard
    from app.domains.screener.service import ScreenerService
    from app.domains.screener.roma_service import RomaScreenerService
    from app.domains.screener.models import ScreenResult, TossStockItem, ScreenCriteria
    from app.domains.report.service import GuruReportService
    from app.domains.error_log.notifiers.discord import DiscordNotifier
    from app.infrastructure.supabase_repo import supabase_repo

    monkeypatch.setattr(MarketCalendarGuard, "is_us_market_open", lambda self, d: (True, "정규장"))
    monkeypatch.setattr(MarketCalendarGuard, "is_kr_market_open", lambda self, d: (True, "정규장"))

    async def mock_screener(self, criteria=None):
        if criteria and criteria.nation == "kr":
            items = [TossStockItem(ticker="005930", stock_code="005930", name="삼성전자", screeners=["국장공통"])]
        else:
            items = [TossStockItem(ticker="AAPL", stock_code="AAPL", name="Apple", screeners=["공통"])]
        return ScreenResult(tickers=items, items=items, total_count=1, count=1, criteria=criteria or ScreenCriteria())

    monkeypatch.setattr(ScreenerService, "get_stock_list", mock_screener)
    monkeypatch.setattr(RomaScreenerService, "get_stock_list", lambda self, **k: asyncio.sleep(0, result=ScreenResult(tickers=[], items=[], total_count=0, count=0, criteria=ScreenCriteria())))
    monkeypatch.setattr(supabase_repo, "get_reported_tickers_for_date", lambda d: set())
    monkeypatch.setattr(DiscordNotifier, "notify_pipeline_summary", lambda *a, **k: asyncio.sleep(0))

    execution_order = []
    us_gate = asyncio.Event()

    async def mock_gen_report(self, ticker, target_date, screeners=None):
        execution_order.append(f"start_{ticker}")
        if ticker == "AAPL":
            # US 종목 분석 중 국장이 들어올 수 있도록 대기
            await us_gate.wait()
        execution_order.append(f"finish_{ticker}")
        class DummyReport:
            overall_verdict = "매수"
        return DummyReport()

    monkeypatch.setattr(GuruReportService, "generate_full_report", mock_gen_report)

    # 1. 미장 파이프라인을 비동기 태스크로 시작
    us_task = asyncio.create_task(us_daily_pipeline_job(force=True))

    # US 파이프라인이 분석 단계에 진입할 때까지 잠깐 yield
    while "start_AAPL" not in execution_order:
        await asyncio.sleep(0.01)

    # 2. 미장이 돌고 있는 도중에 국장 파이프라인 시작 (대기 시작해야 함)
    kr_task = asyncio.create_task(kr_daily_pipeline_job(force=True))

    # 국장 태스크가 즉시 종료되지 않고 미장을 대기 중인지 확인
    await asyncio.sleep(0.05)
    assert not kr_task.done(), "국장 파이프라인이 즉시 종료(스킵)되지 않고 대기 중이어야 합니다."

    # 3. 미장 게이트를 열어 미장 완료 유도
    us_gate.set()
    us_result = await us_task

    # 4. 국장 파이프라인도 이어서 완료 대기
    kr_result = await kr_task

    assert us_result["status"] == "success"
    assert us_result["market"] == "us"
    assert kr_result["status"] == "success"
    assert kr_result["market"] == "kr"

    # 실행 순서 검증: AAPL 시작 -> AAPL 완료 -> 005930 시작 -> 005930 완료
    assert execution_order == ["start_AAPL", "finish_AAPL", "start_005930", "finish_005930"]


@pytest.mark.asyncio
async def test_duplicate_same_market_pipeline_is_skipped(monkeypatch):
    """
    동일한 시장(US)이 이미 실행 중일 때 또 다른 US 파이프라인이 인입되면
    대기열에 중복 진입하지 않고 즉시 스킵되는지 검증
    """
    from app.domains.scheduler.jobs import us_daily_pipeline_job
    from app.domains.scheduler.market_guard import MarketCalendarGuard
    from app.domains.screener.service import ScreenerService
    from app.domains.screener.roma_service import RomaScreenerService
    from app.domains.screener.models import ScreenResult, TossStockItem, ScreenCriteria
    from app.domains.report.service import GuruReportService
    from app.domains.error_log.notifiers.discord import DiscordNotifier
    from app.infrastructure.supabase_repo import supabase_repo

    monkeypatch.setattr(MarketCalendarGuard, "is_us_market_open", lambda self, d: (True, "정규장"))
    items = [TossStockItem(ticker="AAPL", stock_code="AAPL", name="Apple", screeners=["공통"])]
    monkeypatch.setattr(ScreenerService, "get_stock_list", lambda self, c=None: asyncio.sleep(0, result=ScreenResult(tickers=items, items=items, total_count=1, count=1, criteria=ScreenCriteria())))
    monkeypatch.setattr(RomaScreenerService, "get_stock_list", lambda self, **k: asyncio.sleep(0, result=ScreenResult(tickers=[], items=[], total_count=0, count=0, criteria=ScreenCriteria())))
    monkeypatch.setattr(supabase_repo, "get_reported_tickers_for_date", lambda d: set())
    monkeypatch.setattr(DiscordNotifier, "notify_pipeline_summary", lambda *a, **k: asyncio.sleep(0))

    gate = asyncio.Event()

    async def mock_gen_report(self, ticker, target_date, screeners=None):
        await gate.wait()
        class DummyReport:
            overall_verdict = "관망"
        return DummyReport()

    monkeypatch.setattr(GuruReportService, "generate_full_report", mock_gen_report)

    task1 = asyncio.create_task(us_daily_pipeline_job(force=True))
    await asyncio.sleep(0.02)

    # 동일 마켓(US) 중복 실행 시도 -> 대기하지 않고 즉시 skipped 반환
    duplicate_result = await us_daily_pipeline_job(force=True)
    assert duplicate_result["status"] == "skipped"
    assert duplicate_result["reason"] == "already_running"
    assert duplicate_result["market"] == "us"

    gate.set()
    res1 = await task1
    assert res1["status"] == "success"
