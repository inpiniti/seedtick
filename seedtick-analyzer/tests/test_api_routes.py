"""
API 엔드포인트 테스트 (Health, Screener, Scheduler)
"""
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "us_market_today" in data


@pytest.mark.asyncio
async def test_screener_run_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/screener/run")
        assert res.status_code == 200
        data = res.json()
        assert "tickers" in data
        assert "items" in data
        assert "total_count" in data
        assert "count" in data
        assert len(data["tickers"]) == data["count"]
        # 중복 티커가 없는지 검증
        tickers = [item["ticker"] for item in data["tickers"]]
        assert len(tickers) == len(set(tickers))


@pytest.mark.asyncio
async def test_scheduler_cleanup_logs_route(monkeypatch):
    from app.infrastructure.supabase_repo import supabase_repo

    monkeypatch.setattr(supabase_repo, "delete_old_info_logs", lambda hours: 15)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/scheduler/cleanup-logs?hours=24")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["deleted_count"] == 15
        assert data["hours"] == 24


@pytest.mark.asyncio
async def test_scheduler_trigger_route(monkeypatch):
    from unittest.mock import MagicMock
    from app.domains.scheduler.service import scheduler_service

    mock_trigger = MagicMock(
        return_value={
            "status": "started",
            "reason": None,
        }
    )
    monkeypatch.setattr(scheduler_service, "start_pipeline_background", mock_trigger)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/scheduler/trigger?force=true&skip_already_reported=true")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "started"
        mock_trigger.assert_called_once_with(
            dry_run=None, force=True, max_count=None, skip_already_reported=True
        )


@pytest.mark.asyncio
async def test_scheduler_progress_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/scheduler/progress")
        assert res.status_code == 200
        data = res.json()
        assert "status" in data
        assert "stages" in data
        assert "elapsed_seconds" in data


@pytest.mark.asyncio
async def test_roma_screener_route(monkeypatch):
    """두번째 스크리너(/api/screener/roma) 응답 검증 (외부 네트워크 mock)"""
    from app.domains.screener.roma_service import RomaScreenerService
    from app.domains.screener.models import ScreenCriteria, ScreenResult, TossStockItem

    async def mock_get_stock_list(self, min_holders=10, size=0):
        assert min_holders == 10
        items = [
            TossStockItem(
                ticker="MSFT",
                stock_code="MSFT",
                name="Microsoft Corp.",
                price=525.18,
                screeners=["roma"],
                holders=37,
                weight_pct=1.779,
                hold_price=373.02,
                week52_low=348.54,
                week52_high=549.20,
            )
        ]
        return ScreenResult(
            tickers=items,
            items=items,
            total_count=1,
            count=1,
            criteria=ScreenCriteria(preset="roma"),
            source="dataroma_grand_portfolio",
        )

    monkeypatch.setattr(RomaScreenerService, "get_stock_list", mock_get_stock_list)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/screener/roma?min_holders=10")
        assert res.status_code == 200
        data = res.json()
        assert data["source"] == "dataroma_grand_portfolio"
        assert data["count"] == 1
        assert data["total_count"] == 1
        item = data["tickers"][0]
        assert item["ticker"] == "MSFT"
        assert item["holders"] == 37
        assert item["weight_pct"] == 1.779
        assert item["price"] == 525.18
        assert item["screeners"] == ["roma"]
        assert data["criteria"]["preset"] == "roma"


@pytest.mark.asyncio
async def test_ticker_logo_route(monkeypatch):
    from app.domains.screener.logo_service import TickerLogoService

    async def mock_resolve_logo(self, ticker: str):
        assert ticker == "AAPL"
        return "https://static.tossinvest.com/aapl.png", "cached"

    monkeypatch.setattr(TickerLogoService, "resolve_logo", mock_resolve_logo)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/screener/logo/aapl")
        assert res.status_code == 200
        data = res.json()
        assert data["ticker"] == "AAPL"
        assert data["logo_image_url"] == "https://static.tossinvest.com/aapl.png"
        assert data["source"] == "cached"


@pytest.mark.asyncio
async def test_ticker_logos_route(monkeypatch):
    from app.domains.screener.logo_service import TickerLogoService

    async def mock_resolve_logos(self, tickers: list[str], max_count: int = 12):
        assert tickers == ["aapl", "msft"]
        assert max_count == 2
        return [
            ("AAPL", "https://static.tossinvest.com/aapl.png", "cached"),
            ("MSFT", None, "none"),
        ]

    monkeypatch.setattr(TickerLogoService, "resolve_logos", mock_resolve_logos)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/screener/logos", json={"tickers": ["aapl", "msft"], "max_count": 2})
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert len(data["items"]) == 2
        assert data["items"][0]["ticker"] == "AAPL"
        assert data["items"][0]["source"] == "cached"
        assert data["items"][1]["ticker"] == "MSFT"
        assert data["items"][1]["source"] == "none"



