"""
증권사 브릿지 공통 추상 인터페이스 (개방-폐쇄 원칙)
"""
from abc import ABC, abstractmethod
from app.domains.bridge.models import BrokerBalance, BrokerOrder, OrderResult


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
