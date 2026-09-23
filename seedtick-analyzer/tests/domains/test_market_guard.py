"""
MarketCalendarGuard 단위 테스트: 주말 및 미국 증시 휴장일 검증
"""
from datetime import date
from app.domains.scheduler.market_guard import MarketCalendarGuard


def test_weekend_detection():
    guard = MarketCalendarGuard()
    # 2026-09-26은 토요일, 2026-09-27은 일요일
    saturday = date(2026, 9, 26)
    sunday = date(2026, 9, 27)

    is_open_sat, reason_sat = guard.is_market_open(saturday)
    assert not is_open_sat
    assert "주말(토요일)" in reason_sat

    is_open_sun, reason_sun = guard.is_market_open(sunday)
    assert not is_open_sun
    assert "주말(일요일)" in reason_sun


def test_us_holiday_detection():
    guard = MarketCalendarGuard()
    # 2026-01-01 (신정: New Year's Day)
    new_year = date(2026, 1, 1)
    is_open_ny, reason_ny = guard.is_market_open(new_year)
    assert not is_open_ny
    assert "공휴일" in reason_ny

    # 2026-12-25 (크리스마스)
    xmas = date(2026, 12, 25)
    is_open_xm, reason_xm = guard.is_market_open(xmas)
    assert not is_open_xm
    assert "공휴일" in reason_xm


def test_regular_trading_day():
    guard = MarketCalendarGuard()
    # 2026-09-23 수요일 (평일 일반 거래일)
    wednesday = date(2026, 9, 23)
    is_open, reason = guard.is_market_open(wednesday)
    assert is_open
    assert reason == "정상 거래일"
