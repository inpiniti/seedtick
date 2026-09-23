# Auto-Trading 데이터 구조

```python
from pydantic import BaseModel
from typing import Literal

class TradeOrder(BaseModel):
    ticker: str
    action: Literal["BUY", "SELL"]
    amount_krw: int
    report_id: str
    reason: str                         # 매매 근거 (로깅용)

class TradeResult(BaseModel):
    success: bool
    ticker: str
    action: str
    amount_krw: int
    order_id: str | None                # 증권사 주문 ID
    executed_price: float | None
    error_code: str | None
    error_message: str | None

class DailyTradeStats(BaseModel):
    """일일 매매 현황 (한도 체크용)"""
    date: str                           # YYYY-MM-DD
    total_orders: int
    total_amount_krw: int
    remaining_amount_krw: int           # 10만원 - 사용금액
    orders: list[TradeResult]
```

## 상수

```python
# config/constants.py
DAILY_MAX_AMOUNT_KRW = 100_000     # 10만원 (절대 변경 금지)
MAX_ORDERS_PER_DAY = 5
MAX_AMOUNT_PER_ORDER_KRW = 50_000  # 5만원
MIN_REPORT_CONFIDENCE = 70         # 매수 실행 최소 확신도
AMOUNT_PER_ORDER_KRW = 30_000      # 기본 주문 금액 (3만원)
```
