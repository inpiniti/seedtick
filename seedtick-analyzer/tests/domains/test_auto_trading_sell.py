"""
AutoTradingService 분할 매도 단위 테스트

관망(overall_score=2), 매도(overall_score=3) 시그널 시
- 보유 중인 종목만 분할 매도 (1만원씩)
- 보유하지 않은 종목은 스킵
- 당일 동일 종목 중복 매도 방지
- 매도는 일일 한도 없음
"""
import pytest
from app.domains.auto_trading.service import AutoTradingService
from app.domains.bridge.adapters.mock import MockBrokerAdapter
from app.domains.report.models import FinalMasterReport


def _make_report(ticker: str, overall_score: int) -> FinalMasterReport:
    """테스트용 리포트 팩토리"""
    verdict_map = {0: "매수", 1: "보유", 2: "관망", 3: "매도"}
    return FinalMasterReport(
        ticker=ticker,
        date="2026-09-28",
        overall_verdict=verdict_map[overall_score],
        overall_score=overall_score,
        vote_summary="테스트",
        bull_case="테스트 bull",
        bear_case="테스트 bear",
    )


@pytest.mark.asyncio
async def test_sell_watch_signal_with_position():
    """관망(score=2) 시그널 + 보유 종목 → 분할 매도 실행"""
    broker = MockBrokerAdapter(initial_krw=500_000)
    # NVDA 10주 보유 설정
    broker.positions["NVDA"] = 10.0

    svc = AutoTradingService(broker=broker)
    reports = [_make_report("NVDA", overall_score=2)]  # 관망

    results = await svc.execute_from_reports(reports, dry_run=False)

    assert len(results) == 1
    assert results[0].success is True
    assert results[0].action == "SELL"
    assert results[0].ticker == "NVDA"


@pytest.mark.asyncio
async def test_sell_sell_signal_with_position():
    """매도(score=3) 시그널 + 보유 종목 → 분할 매도 실행"""
    broker = MockBrokerAdapter(initial_krw=500_000)
    broker.positions["AAPL"] = 5.0

    svc = AutoTradingService(broker=broker)
    reports = [_make_report("AAPL", overall_score=3)]  # 매도

    results = await svc.execute_from_reports(reports, dry_run=False)

    assert len(results) == 1
    assert results[0].success is True
    assert results[0].action == "SELL"
    assert results[0].ticker == "AAPL"


@pytest.mark.asyncio
async def test_sell_skipped_when_no_position():
    """관망/매도 시그널이라도 보유 없으면 스킵"""
    broker = MockBrokerAdapter(initial_krw=500_000)
    # 포지션 없음

    svc = AutoTradingService(broker=broker)
    reports = [
        _make_report("TSLA", overall_score=2),  # 관망, 미보유
        _make_report("AMZN", overall_score=3),  # 매도, 미보유
    ]

    results = await svc.execute_from_reports(reports, dry_run=False)

    # 보유 없음 → 둘 다 스킵
    assert len(results) == 0


@pytest.mark.asyncio
async def test_sell_no_duplicate_same_ticker_same_day():
    """당일 동일 종목 중복 매도 방지"""
    broker = MockBrokerAdapter(initial_krw=500_000)
    broker.positions["MSFT"] = 20.0

    svc = AutoTradingService(broker=broker)
    reports = [_make_report("MSFT", overall_score=3)]  # 매도

    # 첫 번째 실행
    results1 = await svc.execute_from_reports(reports, dry_run=False)
    assert len(results1) == 1
    assert results1[0].success is True

    # 같은 날 두 번째 실행 → 중복 방지로 스킵
    results2 = await svc.execute_from_reports(reports, dry_run=False)
    assert len(results2) == 0


@pytest.mark.asyncio
async def test_sell_no_daily_limit():
    """매도는 일일 한도(10만원) 제한 없이 모두 실행"""
    broker = MockBrokerAdapter(initial_krw=500_000)
    tickers = ["NVDA", "AAPL", "TSLA", "AMZN", "MSFT", "META", "GOOG", "NFLX", "AMD", "INTC", "QCOM"]
    for t in tickers:
        broker.positions[t] = 3.0

    svc = AutoTradingService(broker=broker)
    reports = [_make_report(t, overall_score=3) for t in tickers]  # 전부 매도

    results = await svc.execute_from_reports(reports, dry_run=False)

    # 11종목 모두 매도 실행 (매수 한도 10만원 초과하더라도 매도는 허용)
    assert len(results) == len(tickers)
    assert all(r.success for r in results)


@pytest.mark.asyncio
async def test_hold_signal_skipped():
    """보유(score=1) 시그널은 매도하지 않음"""
    broker = MockBrokerAdapter(initial_krw=500_000)
    broker.positions["NVDA"] = 10.0

    svc = AutoTradingService(broker=broker)
    reports = [_make_report("NVDA", overall_score=1)]  # 보유

    results = await svc.execute_from_reports(reports, dry_run=False)

    assert len(results) == 0


@pytest.mark.asyncio
async def test_mixed_signals_buy_and_sell():
    """매수 + 관망/매도 혼합 시그널 정상 처리"""
    broker = MockBrokerAdapter(initial_krw=500_000)
    broker.positions["AAPL"] = 5.0  # AAPL 보유

    svc = AutoTradingService(broker=broker)
    reports = [
        _make_report("NVDA", overall_score=0),   # 매수 (신규 매수)
        _make_report("AAPL", overall_score=2),   # 관망 → 보유 중이므로 매도
        _make_report("TSLA", overall_score=3),   # 매도 → 미보유이므로 스킵
    ]

    results = await svc.execute_from_reports(reports, dry_run=False)

    # NVDA 매수 1건 + AAPL 매도 1건 = 2건
    assert len(results) == 2
    actions = {r.ticker: r.action for r in results}
    assert actions["NVDA"] == "BUY"
    assert actions["AAPL"] == "SELL"
