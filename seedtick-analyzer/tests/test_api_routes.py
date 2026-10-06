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





