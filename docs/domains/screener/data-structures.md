# Screener 데이터 구조

```python
from pydantic import BaseModel, Field

class ScreenCriteria(BaseModel):
    """스크리닝 기준 (기본: 토스 13인 거장 공통 필터)"""
    preset: str = "공통"             # 기본 프리셋: '공통' (13인 합의)
    nation: str = "us"               # 미국 주식
    size: int = 200                  # 최대 추출 건수 (최대 200)
    page: int = 1
    exclude_tickers: list[str] = Field(default_factory=list)

class TossStockItem(BaseModel):
    """토스 스크리너 종목 정보"""
    ticker: str                      # 심볼 (예: AAPL, NVDA)
    stock_code: str                  # 토스 코드 (예: US20020523001)
    name: str                        # 한글/영문 종목명
    price: float | None = None       # 현재가 (USD 또는 KRW)
    prev_close: float | None = None  # 전일 종가
    market_cap: float | None = None  # 시가총액
    debt_ratio: float | None = None  # 부채비율
    interest_coverage: float | None = None # 이자보상배율
    operating_margin: float | None = None  # 영업이익률
    roe: float | None = None         # ROE
    logo_image_url: str | None = None

class ScreenResult(BaseModel):
    """스크리닝 실행 결과"""
    tickers: list[TossStockItem]
    total_count: int
    count: int
    criteria: ScreenCriteria
    fetched_at: str                  # ISO 8601
    source: str = "toss_screener"
```
