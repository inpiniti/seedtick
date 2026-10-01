"""
TossWebSocketClient: 토스증권 Open API 실시간 체결가 WebSocket 클라이언트
규약 출처: toss open api 스펙 및 wss://openapi-ws.tossinvest.com/ws/v1
"""
import asyncio
import json
import logging
from typing import Callable, Coroutine, Any
import websockets

logger = logging.getLogger("toss_ws_client")

TOSS_WS_URL = "wss://openapi-ws.tossinvest.com/ws/v1"


class TossWebSocketClient:
    def __init__(
        self,
        get_access_token_func: Callable[[], Coroutine[Any, Any, str]],
        on_trade_tick_func: Callable[[str, float], Coroutine[Any, Any, None]],
    ):
        self._get_token = get_access_token_func
        self._on_trade_tick = on_trade_tick_func
        self._subscribed_tickers: set[str] = set()
        self._ws: Any = None
        self._is_running = False
        self._task: asyncio.Task | None = None
        self._ping_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    @property
    def is_connected(self) -> bool:
        return self._ws is not None and not self._ws.closed

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
        if self._ws:
            await self._ws.close()
            self._ws = None
        if self._task:
            self._task.cancel()
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
        """60초 주기 PING 전송 keepalive"""
        try:
            while self._is_running and self.is_connected:
                await asyncio.sleep(60)
                if self.is_connected:
                    await self._ws.send("PING")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning(f"[TossWS] PING 루프 예외: {e}")

    async def _connection_loop(self) -> None:
        """재연결 루프 (지수 백오프)"""
        backoff = 2.0
        while self._is_running:
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
                    backoff = 2.0
                    logger.info("[TossWS] 🟢 토스 실시간 WebSocket 연결 성공")

                    # 기존 구독 종목 재선언
                    if self._subscribed_tickers:
                        await self._send_subscriptions()

                    # PING 태스크 시작
                    if self._ping_task:
                        self._ping_task.cancel()
                    self._ping_task = asyncio.create_task(self._ping_loop())

                    # 수신 루프
                    async for raw_msg in ws:
                        await self._handle_message(raw_msg)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"[TossWS] WebSocket 연결 단절/오류 ({e}) -> {backoff}초 후 재연결")
                self._ws = None
                if self._ping_task:
                    self._ping_task.cancel()
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)

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
                        await self._on_trade_tick(ticker, price_float)
                    except Exception as e:
                        logger.error(f"[TossWS] 체결가 처리 중 오류 ({ticker}): {e}")
        elif msg_type == "error":
            logger.error(f"[TossWS] 수신 에러 프레임: {data}")
