# 주문 인터페이스 (Bridge 어댑터 계약)

> Bridge는 서버가 아니라 `seedtick-analyzer` 내장 라이브러리입니다.
> 이 인터페이스를 구현하면 어떤 증권사든 추가 가능합니다 (개방-폐쇄 원칙).

## IBrokerAdapter (공통 인터페이스)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

@dataclass
class BrokerOrder:
    ticker: str                          # 종목 코드 (예: NVDA)
    action: Literal["BUY", "SELL"]
    amount_krw: int                      # 만원 단위 (예: 50000 = 5만원)
    order_type: Literal["MARKET"] = "MARKET"  # 시장가만 지원
    memo: str = ""

@dataclass
class BrokerBalance:
    available_krw: int    # 사용 가능 원화
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

class IBrokerAdapter(ABC):
    @abstractmethod
    async def get_balance(self) -> BrokerBalance:
        """현재 잔고 및 포지션 조회"""
        ...

    @abstractmethod
    async def place_order(self, order: BrokerOrder) -> OrderResult:
        """주문 실행 (시장가)"""
        ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """주문 취소"""
        ...

    @abstractmethod
    async def get_quote(self, ticker: str) -> float:
        """현재가 조회"""
        ...
```

---

## 구현체

### TossAdapter
```python
class TossAdapter(IBrokerAdapter):
    # 토스증권 API 기반 구현
    # app/domains/bridge/adapters/toss.py
    ...
```

### KisAdapter
```python
class KisAdapter(IBrokerAdapter):
    # 한국투자증권 Open API 기반 구현
    # app/domains/bridge/adapters/kis.py
    ...
```

---

## 사용 예시

```python
# auto_trading/service.py
from app.domains.bridge.adapters.toss import TossAdapter
from app.config.settings import settings

broker = TossAdapter(api_key=settings.TOSS_API_KEY)

order = BrokerOrder(
    ticker="NVDA",
    action="BUY",
    amount_krw=50000,  # 5만원
    memo="seedtick-2026-09-22"
)

result = await broker.place_order(order)
if not result.success:
    await error_log.notify(f"주문 실패: {result.error_message}")
```

---

## 제약 사항

1. **시장가만** 지원 (지정가 X)
2. **단위**: 만원 단위로 입력, 어댑터 내부에서 원화 변환
3. **종목**: 미국 주식 ticker (예: NVDA, TSLA)
4. **일일 중복 방지**: 같은 ticker 같은 날 2회 주문 불가 (OrderManager가 검사)
