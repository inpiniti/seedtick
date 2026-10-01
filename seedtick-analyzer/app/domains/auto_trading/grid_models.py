"""
Grid Trading Pydantic Models
고정 갭(3%) 실시간 무한 분할 매매 모델
"""
from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field


class GridTradeItem(BaseModel):
    id: str | None = None
    ticker: str
    initial_price: float = Field(..., description="처음매수주가 ($)")
    gap: float = Field(..., description="고정 갭 ($) = initial_price * 0.03")
    last_trade_price: float = Field(..., description="마지막매매주가 ($)")
    order_amount_krw: int = Field(default=1000, description="주문금액 (1000원 고정)")
    status: Literal["ACTIVE", "FINISHED"] = Field(default="ACTIVE", description="상태")
    holdings_qty: float = Field(default=0.0, description="현재 추적 보유 수량")
    total_buy_count: int = Field(default=1, description="누적 매수 횟수")
    total_sell_count: int = Field(default=0, description="누적 매도 횟수")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GridTradingStatus(BaseModel):
    is_ws_connected: bool
    is_market_open: bool
    active_count: int
    active_tickers: list[str]
