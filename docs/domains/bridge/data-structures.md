# Bridge 데이터 구조

> 상세 계약은 [contract/order-interface.md](../../contract/order-interface.md) 참조

```python
from dataclasses import dataclass
from typing import Literal

@dataclass
class BrokerOrder:
    ticker: str
    action: Literal["BUY", "SELL"]
    amount_krw: int              # 원화 금액
    order_type: Literal["MARKET"] = "MARKET"
    memo: str = ""

@dataclass
class BrokerBalance:
    available_krw: int           # 사용 가능 원화
    positions: dict[str, float]  # {ticker: 수량}

@dataclass
class OrderResult:
    success: bool
    order_id: str | None
    ticker: str
    action: str
    executed_price: float | None
    executed_qty: float | None
    error_message: str | None = None
```
