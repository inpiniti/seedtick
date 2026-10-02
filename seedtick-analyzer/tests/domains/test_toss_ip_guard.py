"""
토스 허용 IP 차단 가드 회귀 테스트

핵심 요구사항:
  1. 최초 403(허용 IP 미등록) 감지 시 메모리에 차단 상태를 기억한다.
  2. 차단 상태에서는 토스 API/WebSocket을 더 이상 두드리지 않는다.
  3. 사용자가 IP를 등록한 뒤 "다시 연결"을 요청하면 1회만 실제 확인한다.
"""
import asyncio
import contextlib

import pytest
import websockets

from app.domains.bridge.toss_ip_guard import TossIpBlockedError, toss_ip_guard
from app.domains.bridge.adapters import toss as toss_mod
from app.domains.bridge.adapters.toss import TossBrokerAdapter
from app.domains.bridge.adapters.toss_ws import TossWebSocketClient


@pytest.fixture(autouse=True)
def _reset_guard():
    """테스트 간 차단 상태 누수 방지"""
    toss_ip_guard.clear()
    toss_mod._TOKEN_STATES.clear()
    yield
    toss_ip_guard.clear()
    toss_mod._TOKEN_STATES.clear()


# ── 가드 자체 동작 ────────────────────────────────────────────────
def test_mark_blocked_and_clear_roundtrip():
    assert toss_ip_guard.is_blocked is False

    toss_ip_guard.mark_blocked("IP 미등록")
    assert toss_ip_guard.is_blocked is True
    snap = toss_ip_guard.snapshot()
    assert snap["blocked"] is True
    assert snap["reason"] == "IP 미등록"
    assert snap["block_count"] == 1

    toss_ip_guard.clear()
    assert toss_ip_guard.is_blocked is False
    assert toss_ip_guard.snapshot()["reason"] is None


def test_ensure_allowed_raises_when_blocked():
    toss_ip_guard.mark_blocked("IP 미등록")
    with pytest.raises(TossIpBlockedError):
        toss_ip_guard.ensure_allowed()


@pytest.mark.asyncio
async def test_wait_until_unblocked_wakes_on_clear():
    toss_ip_guard.mark_blocked("IP 미등록")

    async def _clear_soon():
        await asyncio.sleep(0.05)
        toss_ip_guard.clear()

    clear_task = asyncio.create_task(_clear_soon())
    # 이벤트로 즉시 깨어나야 한다 (timeout 2초보다 훨씬 빨리)
    await asyncio.wait_for(toss_ip_guard.wait_until_unblocked(timeout=2.0), timeout=2.0)
    assert toss_ip_guard.is_blocked is False
    await clear_task


# ── 어댑터 단락(short-circuit) ────────────────────────────────────
@pytest.mark.asyncio
async def test_blocked_guard_stops_network_requests(monkeypatch):
    """차단 상태에서는 httpx 호출이 아예 발생하지 않아야 한다."""
    toss_ip_guard.mark_blocked("IP 미등록")
    broker = TossBrokerAdapter(client_id="cid", client_secret="sec", account_seq="1")

    def _boom(*args, **kwargs):
        raise AssertionError("차단 중에는 네트워크 호출이 발생하면 안 됩니다")

    monkeypatch.setattr(toss_mod.httpx, "AsyncClient", _boom)

    with pytest.raises(TossIpBlockedError):
        await broker._request("GET", "/api/v1/holdings")


@pytest.mark.asyncio
async def test_is_us_market_open_uses_fallback_without_network(monkeypatch):
    """차단 상태에서는 장 운영시간도 API 없이 KST 폴백으로 판정해야 한다."""
    toss_ip_guard.mark_blocked("IP 미등록")
    broker = TossBrokerAdapter(client_id="cid", client_secret="sec", account_seq="1")

    async def _boom(*args, **kwargs):
        raise AssertionError("차단 중에는 장 운영시간 API를 호출하면 안 됩니다")

    monkeypatch.setattr(broker, "_request", _boom)

    # 예외 없이 bool 로 판정된다
    assert isinstance(await broker.is_us_market_open(), bool)


@pytest.mark.asyncio
async def test_probe_connection_bypasses_guard(monkeypatch):
    """프로브는 차단 상태에서도 가드를 우회해 1회 실제 요청을 시도해야 한다."""
    toss_ip_guard.mark_blocked("IP 미등록")
    broker = TossBrokerAdapter(client_id="cid", client_secret="sec", account_seq="1")

    seen: dict = {}

    async def fake_request(
        method,
        path,
        json=None,
        params=None,
        with_account_header=True,
        bypass_ip_guard=False,
    ):
        seen["bypass"] = bypass_ip_guard
        seen["path"] = path
        return {}

    monkeypatch.setattr(broker, "_request", fake_request)

    ok, _ = await broker.probe_connection()
    assert ok is True
    assert seen["bypass"] is True
    assert seen["path"] == "/api/v1/market-calendar/US"


# ── WebSocket 재연결 폭주 차단 ────────────────────────────────────
@pytest.mark.asyncio
async def test_ws_defers_reconnect_while_ip_blocked(monkeypatch):
    """차단 중에는 WebSocket 연결을 시도하지 않고, 해제되면 다시 시도해야 한다."""
    toss_ip_guard.mark_blocked("IP 미등록")

    attempts = {"n": 0}

    def _fake_connect(*args, **kwargs):
        attempts["n"] += 1
        raise RuntimeError("연결 시도됨")

    monkeypatch.setattr(websockets, "connect", _fake_connect)
    monkeypatch.setattr(
        TossWebSocketClient,
        "_sleep_backoff",
        lambda self, s: asyncio.sleep(0),
    )

    client = TossWebSocketClient(
        get_access_token_func=lambda: asyncio.sleep(0, result="TOK"),
        on_trade_tick_func=lambda t, p: asyncio.sleep(0),
    )
    client._is_running = True
    task = asyncio.create_task(client._connection_loop())

    await asyncio.sleep(0.1)
    assert attempts["n"] == 0, "차단 중에는 토스 문을 두드리면 안 됩니다"

    # 사용자가 IP를 등록해 차단이 풀리면 즉시 재시도한다
    toss_ip_guard.clear()
    await asyncio.sleep(0.1)
    assert attempts["n"] >= 1, "차단 해제 후에는 재연결을 시도해야 합니다"

    client._is_running = False
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task