# Bridge 테스트 케이스

## 원칙

- 실제 증권사 API 호출은 테스트에서 절대 금지
- Mock 또는 Sandbox 환경으로만 테스트

## 단위 테스트

```python
@pytest.mark.asyncio
async def test_toss_place_order_success(mock_toss_http):
    """토스 주문 성공 케이스"""
    mock_toss_http.post.return_value = {"order_id": "T-123", "status": "executed"}
    adapter = TossAdapter(api_key="test-key", http_client=mock_toss_http)
    result = await adapter.place_order(BrokerOrder(ticker="NVDA", action="BUY", amount_krw=30000))
    assert result.success == True
    assert result.order_id == "T-123"

@pytest.mark.asyncio
async def test_insufficient_balance_returns_error(mock_toss_http):
    """잔고 부족 시 OrderResult.success=False"""
    mock_toss_http.post.side_effect = BrokerInsufficientBalanceError()
    adapter = TossAdapter(...)
    result = await adapter.place_order(...)
    assert result.success == False
    assert "BRIDGE_INSUFFICIENT_BALANCE" in (result.error_message or "")
```

## 어댑터 계약 준수 테스트

```python
def test_adapter_implements_interface():
    """모든 어댑터가 IBrokerAdapter를 올바르게 구현하는지 확인"""
    assert issubclass(TossAdapter, IBrokerAdapter)
    assert issubclass(KisAdapter, IBrokerAdapter)
```
