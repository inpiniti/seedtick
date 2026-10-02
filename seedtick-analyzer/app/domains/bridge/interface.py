"""
증권사 브릿지 공통 추상 인터페이스 (개방-폐쇄 원칙)
"""
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

from app.domains.bridge.models import BrokerBalance, BrokerOrder, OrderResult

logger = logging.getLogger("broker_interface")


class IBrokerAdapter(ABC):
    @abstractmethod
    async def get_balance(self) -> BrokerBalance:
        """계좌 잔고 및 보유 종목 조회"""
        pass

    @abstractmethod
    async def place_order(self, order: BrokerOrder) -> OrderResult:
        """미국 주식 시장가 주문 발주"""
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """미체결 주문 취소"""
        pass

    @abstractmethod
    async def get_quote(self, ticker: str) -> float:
        """실시간 현재가(USD) 조회"""
        pass

    async def get_holdings_details(self) -> list[dict]:
        """보유 종목 상세 목록 조회 (symbol, quantity, average_price, last_price 등)"""
        return []

    async def is_us_market_open(self) -> bool:
        """
        현재 시각이 미국 정규장(regularMarket) 거래 시간인지 확인.

        캘린더 API 조회가 가능한 브로커(Toss)는 어댑터가 오버라이드한다.
        기본 구현은 NYSE 휴장일 캘린더 + KST 시간대 폴백으로 판정한다.
        """
        from app.domains.scheduler.market_guard import MarketCalendarGuard

        now_kst = datetime.now(timezone(timedelta(hours=9)))
        is_trading_day, _ = MarketCalendarGuard().is_market_open(now_kst.date())
        if not is_trading_day:
            return False
        # KST 22:30 ~ 익일 06:00 (동부 09:30 ~ 17:00)
        return (now_kst.hour == 22 and now_kst.minute >= 30) or now_kst.hour >= 23 or now_kst.hour < 6

    async def get_exchange_rate(self) -> float:
        """USD/KRW 환율 조회 (기본값 1,370원)"""
        return 1370.0

