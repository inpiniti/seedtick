"""
MarketCalendarGuard: 미국 증시(NYSE) 및 한국 증시(KRX) 거래일/휴장일 판별 가드
"""
import logging
from datetime import date
import holidays

logger = logging.getLogger("market_calendar_guard")


class MarketCalendarGuard:
    def __init__(self):
        # 미국 증시(NYSE) 및 한국 거래소(KRX) 공식 금융 휴장일 캘린더
        self._nyse_holidays = holidays.financial_holidays("NYSE")
        self._krx_holidays = holidays.financial_holidays("KRX")

    def is_us_market_open(self, target_date: date | None = None) -> tuple[bool, str]:
        """
        해당 일자가 미국 정규장(NYSE/NASDAQ) 정상 거래일인지 판별
        Returns: (개장여부, 사유문구)
        """
        check_date = target_date or date.today()

        # 1. 주말 체크 (5: 토요일, 6: 일요일)
        weekday = check_date.weekday()
        if weekday in (5, 6):
            day_name = "토요일" if weekday == 5 else "일요일"
            return False, f"주말({day_name})"

        # 2. 미국 증시(NYSE) 공식 공휴일 체크
        if check_date in self._nyse_holidays:
            holiday_name = self._nyse_holidays.get(check_date)
            return False, f"미국 증시 공휴일({holiday_name})"

        return True, "정상 거래일"

    def is_kr_market_open(self, target_date: date | None = None) -> tuple[bool, str]:
        """
        해당 일자가 한국 정규장(KRX) 정상 거래일인지 판별
        Returns: (개장여부, 사유문구)
        """
        check_date = target_date or date.today()

        # 1. 주말 체크 (5: 토요일, 6: 일요일)
        weekday = check_date.weekday()
        if weekday in (5, 6):
            day_name = "토요일" if weekday == 5 else "일요일"
            return False, f"주말({day_name})"

        # 2. 한국 거래소(KRX) 공식 공휴일 체크
        if check_date in self._krx_holidays:
            holiday_name = self._krx_holidays.get(check_date)
            return False, f"한국 증시 공휴일({holiday_name})"

        return True, "정상 거래일"

    def is_market_open(
        self, target_date: date | None = None, market: str = "us"
    ) -> tuple[bool, str]:
        """
        시장별 거래일 여부 판별 (하위 호환성 유지)
        - market='us' (기본값): 미국 증시 판별
        - market='kr': 한국 증시 판별
        """
        if str(market).lower() == "kr":
            return self.is_kr_market_open(target_date)
        return self.is_us_market_open(target_date)

