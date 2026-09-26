"""
PendingOrderQueue & Toss 예약 주문 단위 테스트
"""
import pytest
from pathlib import Path
from app.domains.bridge.order_queue import PendingOrderQueue
from app.domains.bridge.adapters.mock import MockBrokerAdapter

@pytest.mark.asyncio
async def test_pending_order_queue_lifecycle(tmp_path: Path):
    queue_file = tmp_path / "test_pending.json"
    queue = PendingOrderQueue(file_path=queue_file)

    # 1. 초기 큐 확인
    assert len(queue.get_pending_orders()) == 0

    # 2. 예약 주문 등록
    ok = queue.add_pending_order(
        ticker="AAPL",
        amount_krw=10_000,
        amount_usd=7.34,
        action="BUY",
        client_order_id="test-client-1",
    )
    assert ok is True
    orders = queue.get_pending_orders()
    assert len(orders) == 1
    assert orders[0]["ticker"] == "AAPL"
    assert orders[0]["amount_krw"] == 10_000

    # 3. 당일 동일 종목 중복 등록 방지 검증
    duplicate = queue.add_pending_order(
        ticker="AAPL",
        amount_krw=10_000,
        amount_usd=7.34,
        action="BUY",
    )
    assert duplicate is False
    assert len(queue.get_pending_orders()) == 1

    # 4. 다른 종목 등록
    ok2 = queue.add_pending_order(
        ticker="MSFT",
        amount_krw=10_000,
        amount_usd=7.34,
        action="BUY",
    )
    assert ok2 is True
    assert len(queue.get_pending_orders()) == 2

    # 5. 브로커를 통한 예약 주문 일괄 발주 검증
    mock_broker = MockBrokerAdapter(initial_krw=100_000)
    results = await queue.execute_all_pending(mock_broker)
    assert len(results) == 2
    assert all(r.success for r in results)

    # 6. 발주 완료 후 큐에서 제거되었는지 검증
    remaining = queue.get_pending_orders()
    assert len(remaining) == 0
