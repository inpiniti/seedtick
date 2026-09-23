# Auto-Trading 테스트 케이스

## 핵심 조건 테스트

```python
@pytest.mark.asyncio
async def test_buy_executed_when_all_conditions_met(mock_broker, mock_order_manager):
    """BUY + confidence>=70 + 중복 없음 + 한도 내 → 주문 실행"""
    mock_order_manager.is_already_ordered.return_value = False
    mock_order_manager.can_order_more.return_value = True
    mock_broker.place_order.return_value = OrderResult(success=True, ...)
    
    report = Report(ticker="NVDA", verdict="BUY", confidence=85, ...)
    service = AutoTradingService(broker=mock_broker, order_manager=mock_order_manager)
    results = await service.execute_from_reports([report])
    
    assert len(results) == 1
    assert results[0].success == True
    mock_broker.place_order.assert_called_once()

@pytest.mark.asyncio
async def test_no_order_when_confidence_too_low(mock_broker):
    """confidence < 70 → 주문 실행 안 됨"""
    report = Report(ticker="TSLA", verdict="BUY", confidence=65, ...)
    service = AutoTradingService(broker=mock_broker, ...)
    results = await service.execute_from_reports([report])
    assert len(results) == 0
    mock_broker.place_order.assert_not_called()

@pytest.mark.asyncio
async def test_daily_limit_prevents_extra_order(mock_broker, mock_order_manager):
    """일일 한도 초과 시 추가 주문 불가"""
    mock_order_manager.can_order_more.return_value = False
    reports = [
        Report(ticker="NVDA", verdict="BUY", confidence=85, ...),
        Report(ticker="MSFT", verdict="BUY", confidence=80, ...),
    ]
    service = AutoTradingService(broker=mock_broker, order_manager=mock_order_manager)
    results = await service.execute_from_reports(reports)
    assert len(results) == 0

def test_paper_trading_mode_does_not_call_broker(mock_broker):
    """Paper-trading 모드에서 broker 실제 호출 안 됨"""
    # PAPER_TRADING_MODE=true 설정
    ...
```
