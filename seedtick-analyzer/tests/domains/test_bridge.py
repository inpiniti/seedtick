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


@pytest.mark.asyncio
async def test_toss_place_order_blocked_outside_regular_hours(monkeypatch):
    """장외 시간에는 발주되지 않고, 예약 큐 등록 없이 실패로 반환된다."""
    from unittest.mock import AsyncMock
    from app.domains.bridge.adapters.toss import TossBrokerAdapter

    broker = TossBrokerAdapter(client_id="test-client", client_secret="test-secret", account_seq="1")
    monkeypatch.setattr(broker, "is_us_market_open", AsyncMock(return_value=False))

    sent: list[dict] = []

    async def fake_request(method, path, json=None, params=None, with_account_header=True):
        sent.append({"method": method, "path": path, "json": json})
        return {"orderId": "SHOULD-NOT-HAPPEN"}

    monkeypatch.setattr(broker, "_request", fake_request)

    res = await broker.place_order(
        BrokerOrder(ticker="AMZN", action="BUY", amount_krw=1000, memo="grid-buy-AMZN")
    )

    # 1. 발주는 실패 처리되고 예약 큐에 들어가지 않는다
    assert res.success is False
    assert res.order_id is None
    assert "정규장" in res.error_message

    # 2. 실제 발주 API는 호출되지 않는다 (환율/시세 조회조차 하지 않음)
    assert sent == []


@pytest.mark.asyncio
async def test_toss_place_order_proceeds_in_regular_hours(monkeypatch):
    """정규장 시간에는 소수점 시장가로 즉시 발주된다."""
    from unittest.mock import AsyncMock
    from app.domains.bridge.adapters.toss import TossBrokerAdapter

    broker = TossBrokerAdapter(client_id="test-client", client_secret="test-secret", account_seq="1")
    monkeypatch.setattr(broker, "is_us_market_open", AsyncMock(return_value=True))
    monkeypatch.setattr(broker, "get_exchange_rate", AsyncMock(return_value=1370.0))

    sent: list[dict] = []

    async def fake_request(method, path, json=None, params=None, with_account_header=True):
        sent.append({"method": method, "path": path, "json": json})
        return {"orderId": "ORDER-1"}

    monkeypatch.setattr(broker, "_request", fake_request)

    res = await broker.place_order(
        BrokerOrder(ticker="AMZN", action="BUY", amount_krw=1000, memo="grid-buy-AMZN")
    )

    assert res.success is True
    assert res.order_id == "ORDER-1"
    assert len(sent) == 1
    assert sent[0]["path"] == "/api/v1/orders"
    # 1,000원 / 1370 = 0.73달러지만 토스 최소 주문금액 하한선($1.0)에 걸린다
    assert sent[0]["json"]["orderAmount"] == "1.0"
    assert sent[0]["json"]["side"] == "BUY"


def test_toss_adapter_has_no_order_queue():
    """장외 예약 주문 큐는 삭제되었다 — 새 인스턴스가 큐를 보유하지 않는다."""
    broker = TossBrokerAdapter(client_id="test-client", client_secret="test-secret", account_seq="1")
    assert not hasattr(broker, "_order_queue")


@pytest.mark.asyncio
async def test_toss_place_sell_uses_quantity(monkeypatch):
    """매도(orderQuantity)는 quantity 필드로 발주하며 orderAmount를 쓰지 않는다."""
    from unittest.mock import AsyncMock
    from app.domains.bridge.adapters.toss import TossBrokerAdapter

    broker = TossBrokerAdapter(client_id="test-client", client_secret="test-secret", account_seq="1")
    monkeypatch.setattr(broker, "is_us_market_open", AsyncMock(return_value=True))
    monkeypatch.setattr(broker, "get_exchange_rate", AsyncMock(return_value=1370.0))

    sent: list[dict] = []

    async def fake_request(method, path, json=None, params=None, with_account_header=True):
        sent.append({"method": method, "path": path, "json": json})
        return {"orderId": "ORDER-2"}

    monkeypatch.setattr(broker, "_request", fake_request)

    res = await broker.place_order(
        BrokerOrder(
            ticker="AMZN",
            action="SELL",
            amount_krw=1000,
            quantity=0.0097,
            memo="grid-sell-AMZN",
        )
    )

    assert res.success is True
    assert len(sent) == 1
    body = sent[0]["json"]
    assert body["side"] == "SELL"
    assert body["quantity"] == "0.0097"
    assert "orderAmount" not in body


@pytest.mark.asyncio
async def test_toss_place_order_rejects_zero_quantity(monkeypatch):
    """수량이 0 이하인 주문은 발주 시도 없이 실패로 반환한다."""
    from unittest.mock import AsyncMock
    from app.domains.bridge.adapters.toss import TossBrokerAdapter

    broker = TossBrokerAdapter(client_id="test-client", client_secret="test-secret", account_seq="1")
    monkeypatch.setattr(broker, "is_us_market_open", AsyncMock(return_value=True))

    sent: list[dict] = []

    async def fake_request(method, path, json=None, params=None, with_account_header=True):
        sent.append({"method": method, "path": path, "json": json})
        return {"orderId": "ORDER-3"}

    monkeypatch.setattr(broker, "_request", fake_request)

    res = await broker.place_order(
        BrokerOrder(ticker="AMZN", action="SELL", amount_krw=1000, quantity=0.0)
    )

    assert res.success is False
    assert sent == []

