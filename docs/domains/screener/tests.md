# Screener 테스트 케이스

## 단위 테스트

### 필터 함수 테스트 (`tests/domains/test_screener.py`)

```python
def test_price_filter_excludes_cheap_stocks():
    """최소 주가 미만 종목이 필터링되는지 확인"""
    tickers = [Ticker(symbol="A", price=5.0, ...), Ticker(symbol="B", price=15.0, ...)]
    result = apply_price_filter(tickers, ScreenCriteria(min_price=10.0))
    assert len(result) == 1
    assert result[0].symbol == "B"

def test_volume_filter_excludes_low_volume():
    """최소 거래량 미만 종목이 필터링되는지 확인"""
    ...

def test_exclude_filter_removes_specified_tickers():
    """특정 종목 제외 목록이 적용되는지 확인"""
    ...
```

## 통합 테스트 (Mock 사용)

```python
@pytest.mark.asyncio
async def test_get_stock_list_with_mock_source(mock_yahoo_source):
    """Mock 데이터 소스로 스크리닝 전체 흐름 테스트"""
    mock_yahoo_source.return_value = [Ticker(symbol="NVDA", price=227.0, volume=50_000_000, ...)]
    service = ScreenerService(source=mock_yahoo_source)
    result = await service.get_stock_list(ScreenCriteria())
    assert result.count >= 1
    assert result.tickers[0].symbol == "NVDA"
```

## 실패 케이스

```python
@pytest.mark.asyncio
async def test_fetch_failure_raises_error(mock_yahoo_source):
    """데이터 수집 실패 시 올바른 에러 발생"""
    mock_yahoo_source.side_effect = Exception("network error")
    service = ScreenerService(source=mock_yahoo_source)
    with pytest.raises(ScreenerFetchError):
        await service.get_stock_list(ScreenCriteria())
```
