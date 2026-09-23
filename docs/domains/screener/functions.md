# Screener 함수 명세

## ScreenerService

### `get_stock_list(criteria: ScreenCriteria) -> ScreenResult`

메인 스크리닝 함수. 기준을 만족하는 종목 리스트를 반환합니다.

**흐름**:
1. 데이터 소스(Yahoo Finance)에서 종목 기본 데이터 수집
2. `ScreenCriteria` 필터 적용
3. `ScreenResult` 반환

**에러**:
- 데이터 수집 실패 시 `SCREENER_FETCH_FAILED` 에러 발생
- 필터 통과 종목 0개 시 `SCREENER_EMPTY_RESULT` 경고 로그 (에러 아님)

---

## 데이터 소스 (IStockDataSource)

### `fetch_us_stocks(min_volume: int, min_price: float) -> list[Ticker]`

Yahoo Finance에서 미국 주식 데이터를 가져옵니다.

**구현체**: `YahooDataSource`

**주의**:
- yfinance는 무료이나 API 제한 있음. 요청 간 sleep 필요
- 실패 시 빈 리스트 반환하지 말고 예외 발생

---

## 필터 함수 (filters.py)

```python
def apply_price_filter(tickers: list[Ticker], criteria: ScreenCriteria) -> list[Ticker]
def apply_volume_filter(tickers: list[Ticker], criteria: ScreenCriteria) -> list[Ticker]
def apply_exclude_filter(tickers: list[Ticker], exclude: list[str]) -> list[Ticker]
```

각 필터는 **순수 함수** (사이드 이펙트 없음). 테스트 용이성을 위해 독립적으로 구현.
