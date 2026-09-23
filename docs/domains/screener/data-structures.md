# Screener 데이터 구조

```python
from pydantic import BaseModel

class ScreenCriteria(BaseModel):
    """스크리닝 기준"""
    min_price: float = 10.0           # 최소 주가 (달러)
    max_price: float = 1000.0         # 최대 주가
    min_volume: int = 500_000         # 최소 일 거래량
    min_market_cap_b: float = 1.0     # 최소 시총 (십억 달러)
    exclude_tickers: list[str] = []   # 제외 종목

class Ticker(BaseModel):
    """스크리닝 통과 종목"""
    symbol: str                       # 종목 코드 (예: NVDA)
    name: str                         # 종목명
    price: float
    volume: int
    market_cap: float | None
    sector: str | None

class ScreenResult(BaseModel):
    """스크리닝 실행 결과"""
    tickers: list[Ticker]
    count: int
    criteria: ScreenCriteria
    fetched_at: str                   # ISO 8601
    source: str = "yahoo_finance"
```
