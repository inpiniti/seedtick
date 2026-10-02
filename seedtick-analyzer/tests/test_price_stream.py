"""
실시간 현재가 SSE 스트림 및 가격 허브 테스트
"""
import asyncio
import json

import pytest

from app.domains.auto_trading.price_hub import RealtimePriceHub


# ── RealtimePriceHub 단위 테스트 ────────────────────────────────
@pytest.mark.asyncio
async def test_price_hub_publish_to_subscribers():
    hub = RealtimePriceHub()
    q1 = hub.subscribe()
    q2 = hub.subscribe()
    assert hub.subscriber_count == 2

    hub.publish("aapl", 123.45)

    payload = q1.get_nowait()
    assert payload["type"] == "tick"
    assert payload["ticker"] == "AAPL"  # 대문자 정규화 확인
    assert payload["price"] == 123.45
    assert q2.get_nowait()["ticker"] == "AAPL"

    # 스냅샷은 마지막 체결가를 반환
    assert hub.snapshot() == {"AAPL": 123.45}

    hub.unsubscribe(q1)
    assert hub.subscriber_count == 1


@pytest.mark.asyncio
async def test_price_hub_drops_oldest_when_queue_full():
    """느린 구독자 때문에 큐가 차도 publish는 예외 없이 통과하고 큐는 넘치지 않아야 한다.

    큐가 가득 차면 가장 오래된 틱을 버리고 최신 틱을 넣으므로,
    FIFO 순서상 남아 있는 가장 오래된 항목은 400-256=144 번째 틱이다.
    """
    hub = RealtimePriceHub()
    q = hub.subscribe()

    for i in range(400):
        hub.publish("AAPL", float(i))

    assert q.qsize() == 256  # 큐가 넘치지 않음

    # FIFO이므로 가장 오래된 잔여 항목부터 순서대로 나온다
    assert q.get_nowait()["price"] == 144.0  # 가장 오래된 잔여 항목
    # 최신 틱은 반드시 보존된다 (큐 맨 뒤)
    remaining = [q.get_nowait()["price"] for _ in range(q.qsize())]
    assert remaining[-1] == 399.0


@pytest.mark.asyncio
async def test_price_hub_publish_is_non_blocking_without_subscribers():
    hub = RealtimePriceHub()
    hub.publish("NVDA", 100.0)  # 구독자 0명이어도 예외 없이 통과
    assert hub.snapshot()["NVDA"] == 100.0


# ── SSE 스트림 생성기 테스트 ────────────────────────────────────
class _FakeRequest:
    """is_disconnected() 호출 횟수로 스트림 종료를 제어하는 테스트 더미"""

    def __init__(self, disconnect_after: int = 0):
        self._remaining = disconnect_after

    async def is_disconnected(self) -> bool:
        if self._remaining <= 0:
            return True
        self._remaining -= 1
        return False


async def _collect(stream_response, count: int) -> list:
    frames = []
    async for chunk in stream_response.body_iterator:
        frames.append(chunk.decode() if isinstance(chunk, bytes) else chunk)
        if len(frames) >= count:
            break
    await stream_response.body_iterator.aclose()
    return frames


@pytest.mark.asyncio
async def test_prices_stream_emits_snapshot_then_tick(monkeypatch):
    """SSE 스트림이 스냅샷 → 틱 → keepalive 순서로 이벤트를 방출하는지 검증"""
    from app.api.routes import grid_trading as gt

    fresh_hub = RealtimePriceHub()
    monkeypatch.setattr(gt, "price_hub", fresh_hub)
    monkeypatch.setattr(gt, "_SSE_KEEPALIVE_SEC", 0.05)

    # is_disconnected 3회 후 종료 → 스냅샷, status, 틱, keepalive 까지 읽을 수 있다
    request = _FakeRequest(disconnect_after=3)

    async def _publish_soon():
        await asyncio.sleep(0.02)
        fresh_hub.publish("AAPL", 250.5)

    publisher = asyncio.create_task(_publish_soon())

    response = await gt.stream_realtime_prices(request)  # type: ignore[arg-type]
    assert response.media_type == "text/event-stream"
    assert response.headers["x-accel-buffering"] == "no"
    assert "no-cache" in response.headers["cache-control"]

    frames = await _collect(response, 4)
    await publisher

    # 1. 스냅샷 (서버가 아직 체결가를 못 받은 상태)
    assert frames[0].startswith("event: snapshot")
    assert json.loads(frames[0].split("data: ", 1)[1]) == {"prices": {}}

    # 2. 스냅샷이 비어 있으면 WS 연결 상태를 함께 통지
    assert frames[1].startswith("event: status")
    assert json.loads(frames[1].split("data: ", 1)[1]) == {"ws_connected": False}

    # 3. 실시간 틱
    assert frames[2].startswith("event: tick")
    tick = json.loads(frames[2].split("data: ", 1)[1])
    assert tick == {"type": "tick", "ticker": "AAPL", "price": 250.5}

    # 4. 이벤트 없음 구간 keepalive
    assert frames[3].startswith(": keepalive")

    # 스트림 종료 시 구독자 정리 확인
    assert fresh_hub.subscriber_count == 0


@pytest.mark.asyncio
async def test_prices_stream_snapshot_reflects_existing_prices(monkeypatch):
    """연결 직후 스냅샷에 서버가 이미 보유한 마지막 체결가가 포함돼야 한다"""
    from app.api.routes import grid_trading as gt

    fresh_hub = RealtimePriceHub()
    fresh_hub.publish("NEM", 113.95)
    monkeypatch.setattr(gt, "price_hub", fresh_hub)

    request = _FakeRequest(disconnect_after=1)
    response = await gt.stream_realtime_prices(request)  # type: ignore[arg-type]

    frames = await _collect(response, 2)

    assert frames[0].startswith("event: snapshot")
    assert json.loads(frames[0].split("data: ", 1)[1]) == {"prices": {"NEM": 113.95}}
    assert fresh_hub.subscriber_count == 0


def test_sse_frame_serialization():
    from app.api.routes.grid_trading import _sse

    frame = _sse("tick", {"ticker": "SKHY", "price": 191.125})
    assert frame == 'event: tick\ndata: {"ticker": "SKHY", "price": 191.125}\n\n'


@pytest.mark.asyncio
async def test_market_status_exposes_stream_subscribers():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/grid-trading/market-status")
        assert res.status_code == 200
        data = res.json()
        assert "sse_subscribers" in data
        assert "subscribed_tickers" in data
