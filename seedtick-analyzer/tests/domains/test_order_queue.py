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


@pytest.mark.asyncio
async def test_pending_order_failure_preserves_error(tmp_path: Path):
    from unittest.mock import AsyncMock
    from app.domains.bridge.interface import IBrokerAdapter
    from app.domains.bridge.models import OrderResult

    queue_file = tmp_path / "test_pending_fail.json"
    queue = PendingOrderQueue(file_path=queue_file)

    queue.add_pending_order(
        ticker="SKHY",
        amount_krw=10_000,
        amount_usd=7.34,
        action="BUY",
    )

    # 1. 초기 상태 확인: PENDING
    orders = queue.get_pending_orders()
    assert len(orders) == 1
    assert orders[0]["ticker"] == "SKHY"
    assert orders[0].get("status") == "PENDING"

    # 2. 발주 실패 모의 브로커
    failing_broker = AsyncMock(spec=IBrokerAdapter)
    failing_broker.place_order.return_value = OrderResult(
        success=False,
        ticker="SKHY",
        action="BUY",
        amount_krw=10_000,
        error_message="주문가능 달러가 부족합니다.",
    )

    results = await queue.execute_all_pending(failing_broker)
    assert len(results) == 1
    assert results[0].success is False

    # 3. 실패 후 큐에 보존되고 상태가 FAILED 및 에러메시지가 기록되어 있는지 검증
    remaining = queue.get_pending_orders()
    assert len(remaining) == 1
    assert remaining[0]["status"] == "FAILED"
    assert remaining[0]["error_message"] == "주문가능 달러가 부족합니다."

