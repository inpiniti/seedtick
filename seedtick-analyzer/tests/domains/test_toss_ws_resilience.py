"""
Toss WebSocket 재연결 안정성 회귀 테스트

Reproduces the two production failure modes:
  1. Token war — every broker adapter instance held its own token, so a forced
     reissue in one instance revoked the token another was using (token-revoked).
  2. Receive-loop starvation — trade ticks were handled inline, so a slow DB
     call stalled the reader and the server dropped the socket with no close frame.
"""
import asyncio
import json
import time

import pytest
import websockets

from app.domains.bridge.adapters import toss as toss_mod
from app.domains.bridge.adapters.toss import TossBrokerAdapter
from app.domains.bridge.adapters.toss_ws import TossWebSocketClient


# ─────────────────────────────────────────────────────────────────────
# 1. Token sharing: 인스턴스 간 토큰 상쇄(token-revoked) 방지
# ─────────────────────────────────────────────────────────────────────

def _make_post(tokens: list[str]):
    """httpx.AsyncClient.post를 대체하는 가짜 토큰 발급 응답 생성기"""
    async def _post(self, *args, **kwargs):
        tok = f"TOKEN_{len(tokens)}"
        tokens.append(tok)

        class R:
            status_code = 200

            @staticmethod
            def raise_for_status():
                return None

            @staticmethod
            def json():
                return {"access_token": tok, "expires_in": 86400}
        return R()
    return _post


@pytest.fixture(autouse=True)
def _reset_token_states():
    """계좌별 전역 토큰 상태 초기화 (테스트 간 누수 방지)"""
    toss_mod._TOKEN_STATES.clear()
    yield
    toss_mod._TOKEN_STATES.clear()


@pytest.mark.asyncio
async def test_token_is_shared_across_instances(tmp_path, monkeypatch):
    """별개 인스턴스가 같은 계좌 토큰을 공유해야 서로를 상쇄하지 않는다."""
    cache = tmp_path / "token.json"
    issued: list[str] = []

    monkeypatch.setattr(toss_mod, "_TOSS_CACHE_DIR", tmp_path)
    monkeypatch.setattr(toss_mod, "_token_cache_path", lambda cid: cache)
    monkeypatch.setattr(toss_mod.httpx.AsyncClient, "post", _make_post(issued))

    a = TossBrokerAdapter(client_id="cid", client_secret="sec")
    b = TossBrokerAdapter(client_id="cid", client_secret="sec")

    assert a._token_state is b._token_state

    tok_a = await a._get_access_token()
    tok_b = await b._get_access_token()

    assert tok_a == tok_b == "TOKEN_0"
    # 토큰은 단 한 번만 발급되어야 한다
    assert len(issued) == 1


@pytest.mark.asyncio
async def test_force_reissue_does_not_war_with_other_instances(tmp_path, monkeypatch):
    """force 재발급 시 다른 인스턴스의 토큰을 무효화하지 않아야 한다.

    이 테스트는 수정 전 코드에서 실패한다: 인스턴스별 토큰 보유 시
    force 재발급이 다른 인스턴스의 캐시를 무효화해 401 루프가 발생한다.
    """
    cache = tmp_path / "token.json"
    issued: list[str] = []

    monkeypatch.setattr(toss_mod, "_TOSS_CACHE_DIR", tmp_path)
    monkeypatch.setattr(toss_mod, "_token_cache_path", lambda cid: cache)
    monkeypatch.setattr(toss_mod.httpx.AsyncClient, "post", _make_post(issued))

    a = TossBrokerAdapter(client_id="cid", client_secret="sec")
    b = TossBrokerAdapter(client_id="cid", client_secret="sec")

    await a._get_access_token()
    first = b._token_state.token
    assert first is not None

    # A가 401로 판단해 force 재발급
    await a._get_access_token(force=True)

    # B가 가진 토큰은 여전히 유효해야 한다 (상쇄 루프가 없어야 함)
    assert b._token_state.token == first
    # 이미 최신 토큰이 있으면 불필요한 추가 발급이 일어나지 않아야 한다
    assert len(issued) == 1, "재발급이 상쇄 루프를 유발함"


@pytest.mark.asyncio
async def test_invalidate_token_clears_shared_state(tmp_path, monkeypatch):
    cache = tmp_path / "token.json"
    monkeypatch.setattr(toss_mod, "_TOSS_CACHE_DIR", tmp_path)
    monkeypatch.setattr(toss_mod, "_token_cache_path", lambda cid: cache)

    a = TossBrokerAdapter(client_id="cid", client_secret="sec")
    b = TossBrokerAdapter(client_id="cid", client_secret="sec")
    a._token_state.token = "STALE"
    a._token_state.expires_at = time.time() + 3600

    a.invalidate_token()

    assert a._token_state.token is None
    assert b._token_state.token is None  # 전역 무효화


# ─────────────────────────────────────────────────────────────────────
# 2. 수신 루프 비차단 + 401 핸드셰이크 처리
# ─────────────────────────────────────────────────────────────────────

def _trade_frame(ticker: str, price: float) -> str:
    return json.dumps({
        "type": "message",
        "topic": f"trade:us:{ticker}",
        "data": {"price": price},
    })


class _FakeWS:
    """websockets.connect 컨텍스트 관리자를 흉내내는 최소 구현"""

    def __init__(self):
        self.sent = []
        self._queue: asyncio.Queue = asyncio.Queue()
        self.state = websockets.protocol.State.OPEN

    async def send(self, msg):
        self.sent.append(msg)

    async def recv(self):
        return await self._queue.get()

    def __aiter__(self):
        return self

    async def __anext__(self):
        return await self.recv()

    async def close(self):
        self.state = websockets.protocol.State.CLOSED

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await self.close()
        return False


@pytest.mark.asyncio
async def test_receive_loop_not_blocked_by_slow_tick_handler(monkeypatch):
    """느린 틱 핸들러가 수신 루프를 막지 않아야 한다.

    수정 전 코드에서는 await self._on_trade_tick() 가 수신 루프에서 인라인으로
    실행되어, 느린 처리 중 서버가 연결을 끊으면 'no close frame' 단절이 발생했다.
    """
    ws = _FakeWS()
    handled = asyncio.Event()
    release = asyncio.Event()

    async def _slow_tick(ticker, price):
        handled.set()
        await release.wait()

    client = TossWebSocketClient(
        get_access_token_func=lambda: asyncio.sleep(0, result="TOK"),
        on_trade_tick_func=_slow_tick,
    )
    monkeypatch.setattr(websockets, "connect", lambda *a, **k: ws)

    client._is_running = True
    loop_task = asyncio.create_task(client._connection_loop())
    await asyncio.sleep(0.05)

    await ws._queue.put(_trade_frame("AAPL", 100.0))
    # 느린 핸들러가 시작됨
    await asyncio.wait_for(handled.wait(), timeout=2.0)
    release.set()

    # 핵심: 느린 핸들러가 끝나기 전에 다음 프레임도 수신 루프가 처리해야 한다
    second = asyncio.Event()

    async def _fast_tick(ticker, price):
        second.set()

    client._on_trade_tick = _fast_tick
    await ws._queue.put(_trade_frame("MSFT", 200.0))
    await asyncio.wait_for(second.wait(), timeout=2.0)

    client._is_running = False
    await client.stop()
    # stop() 이 루프 태스크를 취소하므로 완료될 때까지 대기
    await asyncio.wait_for(loop_task, timeout=2.0)


@pytest.mark.asyncio
async def test_401_handshake_invalidates_token_and_retries(monkeypatch):
    """핸드셰이크 401은 공유 토큰을 무효화하고 재시도해야 한다."""
    invalidated = []
    attempts = {"n": 0}

    class _Resp:
        status_code = 401

    err = websockets.exceptions.InvalidStatus(_Resp())

    def _fake_connect(*a, **k):
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise err
        # 두 번째는 성공 후 즉시 종료
        raise asyncio.CancelledError()

    async def _get_token():
        return "TOK"

    client = TossWebSocketClient(
        get_access_token_func=_get_token,
        on_trade_tick_func=lambda t, p: asyncio.sleep(0),
        invalidate_token_func=lambda: invalidated.append(1),
    )
    monkeypatch.setattr(websockets, "connect", _fake_connect)
    monkeypatch.setattr(client, "_sleep_backoff", lambda s: asyncio.sleep(0))

    client._is_running = True
    # _connection_loop 은 CancelledError 를 삼키고 조용히 종료하므로 예외 대신
    # 태스크 완료를 확인한다.
    await asyncio.wait_for(client._connection_loop(), timeout=3.0)

    assert attempts["n"] >= 2, "401 이후 재시도해야 함"
    assert invalidated, "401 발생 시 토큰 무효화 함수가 호출되어야 함"


@pytest.mark.asyncio
async def test_backoff_not_reset_on_short_lived_connection(monkeypatch):
    """짧게 끊기는 연결이 반복되면 백오프가 자꾸 2초로 리셋되지 않아야 한다."""
    sleeps: list[float] = []

    async def _sleep(s):
        sleeps.append(s)
        if len(sleeps) >= 4:
            raise asyncio.CancelledError()

    def _fake_connect(*a, **k):
        # 연결 즉시 예외 (오래 버티지 못함)
        raise RuntimeError("no close frame received or sent")

    client = TossWebSocketClient(
        get_access_token_func=lambda: asyncio.sleep(0, result="TOK"),
        on_trade_tick_func=lambda t, p: asyncio.sleep(0),
    )
    monkeypatch.setattr(websockets, "connect", _fake_connect)
    monkeypatch.setattr(client, "_sleep_backoff", _sleep)

    client._is_running = True
    with pytest.raises(asyncio.CancelledError):
        await client._connection_loop()

    # 백오프가 단조 증가해야 한다 (리셋되지 않음)
    assert sleeps == sorted(sleeps), f"백오프가 리셋됨: {sleeps}"
    assert len(sleeps) >= 3
