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
