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
