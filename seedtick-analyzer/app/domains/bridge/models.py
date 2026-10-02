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
    # 수량 지정 주문(주 단위). 지정 시 amount_krw 대신 quantity로 발주한다.
    # 매도처럼 '보유 수량을 넘지 않는 주문'이 필요한 경우 사용한다
    # (예: 그리드 매도 시 sell_qty = min(1,000원 상당 수량, 보유 수량)).
    quantity: float | None = None


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
