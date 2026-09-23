"""
Bridge 어댑터 및 팩토리 단위 테스트
"""
import pytest
from app.domains.bridge.adapters.mock import MockBrokerAdapter
from app.domains.bridge.adapters.toss import TossBrokerAdapter
from app.domains.bridge.adapters.kis import KisBrokerAdapter
from app.domains.bridge.factory import get_broker_adapter
from app.domains.bridge.models import BrokerOrder


@pytest.mark.asyncio
async def test_mock_broker_order_lifecycle():
    broker = MockBrokerAdapter(initial_krw=100_000, fx_rate=1000.0)

    # 1. 초기 잔고 확인
    bal = await broker.get_balance()
    assert bal.available_krw == 100_000
    assert bal.available_usd == 100.0
    assert len(bal.positions) == 0

    # 2. 매수 주문 (30,000원 -> $30 / $150 = 0.2주)
    buy_order = BrokerOrder(ticker="NVDA", action="BUY", amount_krw=30_000)
    res = await broker.place_order(buy_order)
    assert res.success
    assert res.ticker == "NVDA"
    assert res.executed_qty == 0.2
    assert res.executed_price == 150.0

    # 3. 매수 후 잔고 확인
    bal2 = await broker.get_balance()
    assert bal2.available_krw == 70_000
    assert bal2.positions.get("NVDA") == 0.2

    # 4. 잔고 초과 매수 시도 실패 검증
    huge_order = BrokerOrder(ticker="AAPL", action="BUY", amount_krw=80_000)
    fail_res = await broker.place_order(huge_order)
    assert not fail_res.success
    assert "잔고 부족" in fail_res.error_message


def test_broker_factory():
    mock = get_broker_adapter("mock")
    assert isinstance(mock, MockBrokerAdapter)

    toss = get_broker_adapter("toss")
    assert isinstance(toss, TossBrokerAdapter)

    kis = get_broker_adapter("kis")
    assert isinstance(kis, KisBrokerAdapter)
