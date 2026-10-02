"""
GridTradingService 단위 테스트
TDD Red 단계: 고정 갭(3%) 실시간 무한 분할 매매 규칙 및 라이프사이클 검증
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.domains.auto_trading.grid_models import GridTradeItem
from app.domains.auto_trading.grid_service import GridTradingService
from app.domains.bridge.adapters.mock import MockBrokerAdapter
from app.domains.bridge.models import BrokerOrder, OrderResult


class FakeSupabaseRepo:
    def __init__(self):
        self.items: dict[str, dict] = {}

    def get_active_grid_trades(self) -> list[GridTradeItem]:
        return [
            GridTradeItem(**item)
            for item in self.items.values()
            if item.get("status") == "ACTIVE"
        ]

    def get_all_grid_trades(self) -> list[GridTradeItem]:
        return [GridTradeItem(**item) for item in self.items.values()]

    def save_grid_trade(self, item: GridTradeItem) -> None:
        self.items[item.ticker] = item.model_dump()

    def update_grid_trade(self, item: GridTradeItem) -> None:
        self.items[item.ticker] = item.model_dump()


@pytest.fixture
def mock_broker():
    broker = MockBrokerAdapter(initial_krw=1_000_000)
    broker.positions["NVDA"] = 1.0  # 1주 보유
    broker.is_us_market_open = AsyncMock(return_value=True)
    broker.get_quote = AsyncMock(return_value=100.0)
    broker.get_exchange_rate = AsyncMock(return_value=1000.0)
    return broker


@pytest.fixture
def fake_repo():
    return FakeSupabaseRepo()


@pytest.fixture
def grid_service(mock_broker, fake_repo):
    service = GridTradingService(broker=mock_broker, repo=fake_repo)
    return service


def test_grid_item_initial_gap_calculation():
    """불변식 1: 갭은 처음매수주가의 3%로 고정 계산된다."""
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=round(100.0 * 0.03, 4),
        last_trade_price=100.0,
        holdings_qty=0.5,
    )
    assert item.initial_price == 100.0
    assert item.gap == 3.0
    assert item.last_trade_price == 100.0
    assert item.order_amount_krw == 1000
    assert item.status == "ACTIVE"


@pytest.mark.asyncio
async def test_manual_buy_and_register_success(grid_service, mock_broker, fake_repo):
    """0. 수동 진입: 정규장일 때 매수 발주 후 갭 3% 아이템으로 등록된다."""
    item = await grid_service.manual_buy_and_register(ticker="NVDA")

    assert item.ticker == "NVDA"
    assert item.initial_price == 100.0
    assert item.gap == 3.0
    assert item.last_trade_price == 100.0
    assert item.status == "ACTIVE"
    assert "NVDA" in fake_repo.items


@pytest.mark.asyncio
async def test_manual_buy_blocked_when_market_closed(grid_service, mock_broker):
    """불변식 3: 정규장이 아니면 수동 매수 등록이 거부된다."""
    mock_broker.is_us_market_open = AsyncMock(return_value=False)
    with pytest.raises(ValueError, match="정규장"):
        await grid_service.manual_buy_and_register(ticker="NVDA")


@pytest.mark.asyncio
async def test_realtime_sell_trigger_partial(grid_service, fake_repo, mock_broker):
    """1. 현재가가 마지막매매주가 + 갭 이상이면 매도 발주 및 마지막매매주가 갱신"""
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=3.0,
        last_trade_price=100.0,
        holdings_qty=1.0,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    # 103.0 (+3.0 갭 도달)
    await grid_service.on_realtime_tick("NVDA", 103.0)

    updated = fake_repo.items["NVDA"]
    assert updated["last_trade_price"] == 103.0
    assert updated["total_sell_count"] == 1
    assert updated["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_realtime_sell_trigger_finish_when_no_qty(grid_service, fake_repo, mock_broker):
    """1-2. 매도하고 남은 수량이 없는 경우는 해당 로우 종료(FINISHED) 처리"""
    mock_broker.positions["NVDA"] = 0.0097
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=3.0,
        last_trade_price=100.0,
        holdings_qty=0.0097,  # 이번 1000원치 매도로 전량 소진되는 소액 수량
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    # 103.0 (+3.0 갭 도달)
    await grid_service.on_realtime_tick("NVDA", 103.0)

    updated = fake_repo.items["NVDA"]
    assert updated["status"] == "FINISHED"


@pytest.mark.asyncio
async def test_realtime_sell_capped_at_holdings(grid_service, fake_repo, mock_broker):
    """1-3. 1,000원치 수량이 보유 수량보다 크면 보유 수량으로만 매도한다(초과 매도 방지)."""
    # 보유 0.0007주 (약 500원어치) — 1,000원치 매도가 보유를 초과하는 상황
    mock_broker.positions["NVDA"] = 0.0007
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=3.0,
        last_trade_price=100.0,
        holdings_qty=0.0007,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    # 103.0 (+3.0 갭 도달)
    await grid_service.on_realtime_tick("NVDA", 103.0)

    # 발주된 매도 수량은 보유 수량을 초과하지 않는다
    sell_orders = [o for o in mock_broker.order_history if o.action == "SELL"]
    assert len(sell_orders) == 1
    assert sell_orders[0].quantity is not None
    assert sell_orders[0].quantity <= 0.0007

    # 전량 매도되어 종료 처리
    updated = fake_repo.items["NVDA"]
    assert updated["holdings_qty"] == 0.0
    assert updated["status"] == "FINISHED"
    assert updated["total_sell_count"] == 1


@pytest.mark.asyncio
async def test_realtime_sell_partial_leaves_remainder(grid_service, fake_repo, mock_broker):
    """1-1. 보유 수량이 충분하면 1,000원치만 매도하고 잔여 수량을 유지한다."""
    mock_broker.positions["NVDA"] = 1.0
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=3.0,
        last_trade_price=100.0,
        holdings_qty=1.0,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    await grid_service.on_realtime_tick("NVDA", 103.0)

    sell_orders = [o for o in mock_broker.order_history if o.action == "SELL"]
    assert len(sell_orders) == 1
    # 1,000원 / 1,000원fx / $103 = 약 0.0097주
    assert sell_orders[0].quantity == pytest.approx(0.0097, abs=1e-4)

    updated = fake_repo.items["NVDA"]
    assert updated["status"] == "ACTIVE"
    assert updated["holdings_qty"] == pytest.approx(0.9903, abs=1e-3)
    assert updated["last_trade_price"] == 103.0


@pytest.mark.asyncio
async def test_no_order_when_market_closed(grid_service, fake_repo, mock_broker):
    """장외 시간에는 갭이 도달해도 발주하지 않는다(감지만 유지)."""
    mock_broker.is_us_market_open = AsyncMock(return_value=False)
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=3.0,
        last_trade_price=100.0,
        holdings_qty=1.0,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    # 익절 갭 도달 (매도 트리거)
    await grid_service.on_realtime_tick("NVDA", 103.0)
    # 하락 갭 도달 (매수 트리거)
    await grid_service.on_realtime_tick("NVDA", 97.0)

    assert mock_broker.order_history == []
    updated = fake_repo.items["NVDA"]
    assert updated["status"] == "ACTIVE"
    assert updated["last_trade_price"] == 100.0
    assert updated["total_sell_count"] == 0
    assert updated["total_buy_count"] == 1  # 초기 수동 매수 1회


@pytest.mark.asyncio
async def test_market_status_check_is_cached(grid_service, fake_repo, mock_broker):
    """장외 틱이 반복돼도 정규장 여부 조회는 TTL 캐시로 재사용된다."""
    mock_broker.is_us_market_open = AsyncMock(return_value=True)
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=3.0,
        last_trade_price=100.0,
        holdings_qty=100.0,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    for _ in range(5):
        # 트리거가 아니어서 market check까지 도달하지 않아야 한다
        await grid_service.on_realtime_tick("NVDA", 101.0)

    mock_broker.is_us_market_open.assert_not_called()

    # 갭 도달 시 1회만 조회
    await grid_service.on_realtime_tick("NVDA", 103.0)
    await grid_service.on_realtime_tick("NVDA", 106.0)
    assert mock_broker.is_us_market_open.call_count == 1


@pytest.mark.asyncio
async def test_realtime_buy_trigger(grid_service, fake_repo, mock_broker):
    """2. 현재가가 마지막매매주가 - 갭 이하인 경우 매수 발주 및 마지막매수주가 수정"""
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=3.0,
        last_trade_price=100.0,
        holdings_qty=0.5,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    # 97.0 (-3.0 갭 이하)
    await grid_service.on_realtime_tick("NVDA", 97.0)

    updated = fake_repo.items["NVDA"]
    assert updated["last_trade_price"] == 97.0
    assert updated["total_buy_count"] == 2
    assert updated["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_ping_pong_sequence(grid_service, fake_repo, mock_broker):
    """4. 핑퐁 매매: 100 -> 97(매수) -> 100(매도) 연속 사이클 검증"""
    item = GridTradeItem(
        ticker="NVDA",
        initial_price=100.0,
        gap=3.0,
        last_trade_price=100.0,
        holdings_qty=1.0,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    # 1. 97.0 하락 -> 매수 발생
    await grid_service.on_realtime_tick("NVDA", 97.0)
    assert fake_repo.items["NVDA"]["last_trade_price"] == 97.0
    assert fake_repo.items["NVDA"]["total_buy_count"] == 2

    # 2. 98.0 애매한 반등 -> 트리거 없음 (기준 97 + 3 = 100 이상이어야 함)
    await grid_service.on_realtime_tick("NVDA", 98.0)
    assert fake_repo.items["NVDA"]["last_trade_price"] == 97.0

    # 3. 100.0 도달 (+3.0 반등) -> 매도 발생
    await grid_service.on_realtime_tick("NVDA", 100.0)
    assert fake_repo.items["NVDA"]["last_trade_price"] == 100.0
    assert fake_repo.items["NVDA"]["total_sell_count"] == 1


@pytest.mark.asyncio
async def test_sync_holdings_closes_absent_ticker(grid_service, fake_repo, mock_broker):
    """0-3. 등록되어 있었는데 보유종목에서 사라진 경우는 종료 처리"""
    item = GridTradeItem(
        ticker="TSLA",
        initial_price=200.0,
        gap=6.0,
        last_trade_price=200.0,
        holdings_qty=1.0,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    # mock_broker 잔고에는 NVDA만 있고 TSLA는 없음
    mock_broker.positions = {"NVDA": 1.0}

    await grid_service.sync_with_holdings()

    assert fake_repo.items["TSLA"]["status"] == "FINISHED"


@pytest.mark.asyncio
async def test_sync_holdings_auto_registers_existing_portfolio(grid_service, fake_repo, mock_broker):
    """0. 보유 중인데 등록 안 된 종목도 잔고 동기화 시 자동으로 그리드에 신규 등록된다."""
    # mock_broker에 get_holdings_details가 AAPL 종목 정보를 반환하도록 설정
    mock_broker.get_holdings_details = AsyncMock(
        return_value=[
            {
                "symbol": "AAPL",
                "quantity": 0.1234,
                "average_price": 150.0,
                "last_price": 155.0,
            }
        ]
    )
    mock_broker.positions = {"AAPL": 0.1234}

    await grid_service.sync_with_holdings()

    assert "AAPL" in fake_repo.items
    aapl_item = fake_repo.items["AAPL"]
    assert aapl_item["ticker"] == "AAPL"
    assert aapl_item["initial_price"] == 150.0
    assert aapl_item["gap"] == 4.5  # 150 * 0.03
    assert aapl_item["last_trade_price"] == 150.0
    assert aapl_item["holdings_qty"] == 0.1234
    assert aapl_item["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_sync_holdings_preserves_active_on_broker_error(grid_service, fake_repo, mock_broker):
    """서버 재시작 후 IP 변경 등으로 브로커 연동 에러 시 기존 활성 종목이 FINISHED로 바뀌지 않고 보호된다."""
    item = GridTradeItem(
        ticker="SKHY",
        initial_price=187.82,
        gap=5.63,
        last_trade_price=187.82,
        holdings_qty=0.2553,
        status="ACTIVE",
    )
    fake_repo.save_grid_trade(item)

    # 브로커 연동 실패 (예: 토스 API 403 Forbidden / IP 변경)
    mock_broker.get_balance = AsyncMock(side_effect=PermissionError("토스 API 403 Forbidden: IP 미등록"))

    with pytest.raises(PermissionError):
        await grid_service.sync_with_holdings()

    # 에러가 발생해도 기존 SKHY는 FINISHED가 아니라 여전히 ACTIVE 상태를 유지해야 함
    assert fake_repo.items["SKHY"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_sync_holdings_circuit_breaker_on_empty_positions(grid_service, fake_repo, mock_broker):
    """기존 활성 종목이 존재하는데 브로커에서 보유 주식이 0개로 반환된 경우 안전장치가 발동하여 일괄 종료를 건너뛴다."""
    for sym in ["SKHY", "AMZN", "CVX", "NEM"]:
        fake_repo.save_grid_trade(
            GridTradeItem(
                ticker=sym,
                initial_price=100.0,
                gap=3.0,
                last_trade_price=100.0,
                holdings_qty=1.0,
                status="ACTIVE",
            )
        )

    # 브로커가 비정상적으로 빈 잔고(0개)를 반환
    mock_broker.positions = {}

    await grid_service.sync_with_holdings()

    # 서킷 브레이커로 인해 4개 종목 모두 FINISHED로 바뀌지 않고 ACTIVE로 유지됨
    for sym in ["SKHY", "AMZN", "CVX", "NEM"]:
        assert fake_repo.items[sym]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_reactivate_grid_trade_success(grid_service, fake_repo, mock_broker):
    """종료된(FINISHED) 그리드 종목을 다시 활성화하면 ACTIVE로 상태가 복원된다."""
    item = GridTradeItem(
        ticker="SKHY",
        initial_price=187.82,
        gap=5.63,
        last_trade_price=187.82,
        holdings_qty=0.2553,
        status="FINISHED",
    )
    fake_repo.save_grid_trade(item)

    mock_ws = AsyncMock()
    mock_ws.subscribe_tickers = AsyncMock()
    grid_service._ws_subscriber = mock_ws

    res = await grid_service.reactivate_grid_trade("SKHY")

    assert res.ticker == "SKHY"
    assert res.status == "ACTIVE"
    assert fake_repo.items["SKHY"]["status"] == "ACTIVE"
    mock_ws.subscribe_tickers.assert_called_once_with(["SKHY"])


