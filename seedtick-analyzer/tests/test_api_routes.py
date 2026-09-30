"""
API 엔드포인트 테스트 (IP, Bridge, AutoTrading)
"""
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_ip_route():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/ip")
        assert res.status_code == 200
        data = res.json()
        assert "client_ip" in data
        assert "server_public_ip" in data
        assert "guide" in data


@pytest.mark.asyncio
async def test_bridge_routes():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. bridge status
        res1 = await ac.get("/api/bridge/status")
        assert res1.status_code == 200
        data1 = res1.json()
        assert "default_broker" in data1
        assert "dry_run" in data1
        assert "configured_adapters" in data1

        # 2. bridge balance (mock)
        res2 = await ac.get("/api/bridge/balance?broker_type=mock")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["broker"] == "mock"
        assert "available_krw" in data2

        # 3. auto-trading status
        res3 = await ac.get("/api/auto-trading/status")
        assert res3.status_code == 200
        data3 = res3.json()
        assert "strategy_rule" in data3
        assert "today_ordered_tickers" in data3
        assert data3["order_action"].startswith("BUY")

        # 4. auto-trading pending-orders
        res4 = await ac.get("/api/auto-trading/pending-orders")
        assert res4.status_code == 200
        data4 = res4.json()
        assert "pending_count" in data4
        assert "orders" in data4
        assert isinstance(data4["orders"], list)


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


