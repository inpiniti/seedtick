"""
TossWebSocketClient: 토스증권 Open API 실시간 체결가 WebSocket 클라이언트
규약 출처: toss open api 스펙 및 wss://openapi-ws.tossinvest.com/ws/v1
"""
import asyncio
import contextlib
import json
import logging
import random
from typing import Callable, Coroutine, Any
import websockets
import websockets.exceptions
import websockets.protocol

logger = logging.getLogger("toss_ws_client")

TOSS_WS_URL = "wss://openapi-ws.tossinvest.com/ws/v1"

# 텍스트 PING 주기 (토스 규약) — 프로토콜 레벨 ping은 비활성화
_PING_INTERVAL = 30.0
# 이 시간 이상 버티지 못한 연결은 성공으로 치지 않아 백오프를 초기화하지 않음
_STABLE_CONN_SEC = 60.0
# 동시 체결 처리 태스크 상한 (수신 루프가 blockbuster되지 않도록 제한)
_MAX_CONCURRENT_TICKS = 32


class TossWebSocketClient:
    def __init__(
        self,
        get_access_token_func: Callable[[], Coroutine[Any, Any, str]],
        on_trade_tick_func: Callable[[str, float], Coroutine[Any, Any, None]],
        invalidate_token_func: Callable[[], None] | None = None,
    ):
        self._get_token = get_access_token_func
        self._invalidate_token = invalidate_token_func
        self._on_trade_tick = on_trade_tick_func
        self._subscribed_tickers: set[str] = set()
        self._ws: Any = None
        self._is_running = False
        self._task: asyncio.Task | None = None
        self._ping_task: asyncio.Task | None = None
        self._tick_tasks: set[asyncio.Task] = set()
        self._tick_semaphore = asyncio.Semaphore(_MAX_CONCURRENT_TICKS)
        self._lock = asyncio.Lock()

    @property
    def is_connected(self) -> bool:
        ws = self._ws
        if ws is None:
            return False
        # websockets 14+ 에서 ClientConnection.closed 가 제거됨 (13.x deprecated)
        closed = getattr(ws, "closed", None)
        if closed is not None:
            return not closed
        return ws.state is websockets.protocol.State.OPEN

    @property
    def subscribed_tickers(self) -> list[str]:
        return sorted(list(self._subscribed_tickers))

    async def start(self) -> None:
        """클라이언트 루프 시작"""
        if self._is_running:
            return
        self._is_running = True
        self._task = asyncio.create_task(self._connection_loop())
        logger.info("[TossWS] 실시간 웹소켓 클라이언트 백그라운드 태스크 시작")

    async def stop(self) -> None:
        """클라이언트 정지"""
        self._is_running = False
        if self._ping_task:
            self._ping_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._ping_task
            self._ping_task = None
        for t in list(self._tick_tasks):
            t.cancel()
        if self._tick_tasks:
            await asyncio.gather(*list(self._tick_tasks), return_exceptions=True)
            self._tick_tasks.clear()
        if self._ws:
            with contextlib.suppress(Exception):
                await self._ws.close()
            self._ws = None
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        logger.info("[TossWS] 실시간 웹소켓 클라이언트 정지")

    async def subscribe_tickers(self, tickers: list[str]) -> None:
        """구독 종목 추가 및 선언 전송"""
        new_tickers = {t.upper() for t in tickers if t}
        if not new_tickers.issubset(self._subscribed_tickers):
            self._subscribed_tickers.update(new_tickers)
            await self._send_subscriptions()

    async def set_subscribed_tickers(self, tickers: list[str]) -> None:
        """구독 종목 전체 교체 및 선언 전송"""
        self._subscribed_tickers = {t.upper() for t in tickers if t}
        await self._send_subscriptions()

    async def _send_subscriptions(self) -> None:
        """선언형 Full-Replace 구독 전송"""
        if not self.is_connected:
            return

        codes = sorted(list(self._subscribed_tickers))
        if not codes:
            payload = []
        else:
            payload = [
                {
                    "type": "trade:us",
                    "codes": codes,
                }
            ]

        try:
            msg = json.dumps(payload)
            await self._ws.send(msg)
            logger.info(f"[TossWS] 실시간 체결 구독 선언 전송: {codes}")
        except Exception as e:
            logger.warning(f"[TossWS] 구독 선언 전송 실패: {e}")

    async def _ping_loop(self) -> None:
        """30초 주기 PING 전송 keepalive (토스 규약: 텍스트 PING)"""
        try:
            while self._is_running and self.is_connected:
                await asyncio.sleep(_PING_INTERVAL)
                if not self.is_connected:
                    break
                await self._ws.send("PING")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning(f"[TossWS] PING 루프 예외: {e}")

    async def _connection_loop(self) -> None:
        """재연결 루프 (지수 백오프 + 지터, 401 시 토큰 강제 무효화)"""
        backoff = 2.0
        while self._is_running:
            connected_at: float | None = None
            try:
                token = await self._get_token()
                extra_headers = {"Authorization": f"Bearer {token}"}

                logger.info(f"[TossWS] 연결 시도 중 -> {TOSS_WS_URL}")
                async with websockets.connect(
                    TOSS_WS_URL,
                    additional_headers=extra_headers,
                    ping_interval=None,  # 토스 규약에 따라 텍스트 PING 직접 제어
                ) as ws:
                    self._ws = ws
                    connected_at = asyncio.get_running_loop().time()
                    logger.info("[TossWS] 🟢 토스 실시간 WebSocket 연결 성공")

                    # 기존 구독 종목 재선언
                    if self._subscribed_tickers:
                        await self._send_subscriptions()

                    # PING 태스크 시작
                    if self._ping_task:
                        self._ping_task.cancel()
                    self._ping_task = asyncio.create_task(self._ping_loop())

                    # 수신 루프
                    try:
                        async for raw_msg in ws:
                            await self._handle_message(raw_msg)
                    finally:
                        # 연결 종료 시 진행 중 체결 처리 태스크 정리
                        await self._drain_tick_tasks()

            except asyncio.CancelledError:
                break
            except websockets.exceptions.InvalidStatus as e:
                # 핸드셰이크 401: 토큰 만료/상쇄 → 공유 토큰 무효화 후 재발급
                status = getattr(getattr(e, "response", None), "status_code", None)
                if status in (401, 403):
                    logger.warning(
                        f"[TossWS] 연결 거부 HTTP {status} — 토큰 무효화 후 재시도 "
                        f"({backoff:.0f}초 후)"
                    )
                    if self._invalidate_token:
                        self._invalidate_token()
                else:
                    logger.warning(
                        f"[TossWS] WebSocket 연결 거부 ({e}) -> {backoff:.0f}초 후 재연결"
                    )
                await self._sleep_backoff(backoff)
                backoff = min(backoff * 2, 60.0)
            except Exception as e:
                # 안정적으로 버텼다면 백오프를 초기화 (단절 루프 hammering 방지)
                loop = asyncio.get_running_loop()
                if connected_at is not None and (loop.time() - connected_at) >= _STABLE_CONN_SEC:
                    backoff = 2.0
                logger.warning(f"[TossWS] WebSocket 연결 단절/오류 ({e}) -> {backoff:.0f}초 후 재연결")
                self._ws = None
                if self._ping_task:
                    self._ping_task.cancel()
                    self._ping_task = None
                await self._sleep_backoff(backoff)
                backoff = min(backoff * 2, 60.0)

    async def _sleep_backoff(self, seconds: float) -> None:
        """지수 백오프 + 랜덤 지터 (여러 인스턴스 동시 재접속 시 thundering herd 방지)"""
        if not self._is_running:
            return
        jitter = random.uniform(0, min(2.0, seconds * 0.25))
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.sleep(seconds + jitter)

    async def _drain_tick_tasks(self) -> None:
        """진행 중 체결 처리 태스크 종료 대기 (취소 포함)"""
        tasks = [t for t in list(self._tick_tasks) if not t.done()]
        if not tasks:
            self._tick_tasks.clear()
            return
        for t in tasks:
            t.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.gather(*tasks, return_exceptions=True)
        self._tick_tasks.clear()

    async def _handle_message(self, raw_msg: str | bytes) -> None:
        """수신 프레임 파싱 및 체결가 라우팅"""
        if isinstance(raw_msg, bytes):
            raw_msg = raw_msg.decode("utf-8", errors="ignore")

        if raw_msg == "PONG":
            return

        try:
            data = json.loads(raw_msg)
        except Exception:
            return

        msg_type = data.get("type")
        if msg_type == "subscriptions":
            # ack 응답
            ack_info = data.get("subscriptions", {})
            logger.info(f"[TossWS] 구독 ACK: {ack_info}")
        elif msg_type == "message":
            # topic 형식: trade:us:AAPL
            topic = str(data.get("topic", ""))
            frame = data.get("data", {})
            parts = topic.split(":")
            if len(parts) >= 3 and parts[0] == "trade":
                ticker = parts[2].upper()
                price = frame.get("price")
                if price is not None:
                    try:
                        price_float = float(price)
                    except (TypeError, ValueError):
                        return
                    # 체결 처리를 별도 태스크로 분리 — 수신 루프가 DB/주문 I/O로
                    # 막히면 서버가 연결을 끊기 때문에 절대 인라인 처리하지 않는다.
                    self._spawn_tick_task(ticker, price_float)
        elif msg_type == "error":
            logger.error(f"[TossWS] 수신 에러 프레임: {data}")

    def _spawn_tick_task(self, ticker: str, price: float) -> None:
        """체결 처리 태스크 생성 (동시 실행 수 상한 적용)"""
        if self._tick_semaphore.locked():
            # 처리량이 상한을 초과하면 최신 틱만 유지 (체결가는 스킵해도 무방)
            return
        task = asyncio.create_task(self._run_tick(ticker, price))
        self._tick_tasks.add(task)
        task.add_done_callback(self._tick_tasks.discard)

    async def _run_tick(self, ticker: str, price: float) -> None:
        async with self._tick_semaphore:
            try:
                await self._on_trade_tick(ticker, price)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"[TossWS] 체결가 처리 중 오류 ({ticker}): {e}")
