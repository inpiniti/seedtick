"""
Bridge 도메인 데이터 모델 (Pydantic / Dataclass)
"""
from typing import Literal
from pydantic import BaseModel, Field


class BrokerOrder(BaseModel):
    """주문 요청 모델"""
    ticker: str                          # 미국 주식 종목 티커 (예: NVDA, AAPL)
    action: Literal["BUY", "SELL"]
    amount_krw: int                      # 원화 주문 금액 (예: 30000 = 3만원)
    order_type: Literal["MARKET"] = "MARKET"  # 안전을 위해 시장가만 지원
    memo: str = ""                       # 식별 메모 (예: seedtick-2026-09-23)


class BrokerBalance(BaseModel):
    """계좌 잔고 모델"""
    available_krw: int                   # 주문 가능 원화
    available_usd: float = 0.0           # 주문 가능 달러
    positions: dict[str, float] = Field(default_factory=dict)  # {ticker: 보유수량}


class OrderResult(BaseModel):
    """주문 실행 결과 모델"""
    success: bool
    order_id: str | None = None
    ticker: str
    action: str
    amount_krw: int
    executed_price: float | None = None  # 체결 단가 (USD)
    executed_qty: float | None = None    # 체결 수량 (주)
    error_message: str | None = None
