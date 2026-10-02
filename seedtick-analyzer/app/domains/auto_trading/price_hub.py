"""
RealtimePriceHub: 토스 실시간 체결가를 구독자(관리 화면 SSE)에게 브로드캐스트하는 인메모리 허브

- publish()는 동기/비차단 호출이다. 토스 WS 수신 루프에서 호출되므로 절대로 await 하지 않는다.
- 구독자는 asyncio.Queue 를 들고 있으며, 큐가 가득 차면 가장 오래된 항목을 버린다
  (관리 화면이 느려도 체결 처리 루프를 막지 않기 위함).
"""
import asyncio
import logging
from typing import Any

logger = logging.getLogger("realtime_price_hub")

# 구독자 큐 최대 크기 (관리 화면 지연 시 오래된 체결부터 폐기)
_MAX_QUEUE_SIZE = 256


class RealtimePriceHub:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._latest: dict[str, float] = {}

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)

    def snapshot(self) -> dict[str, float]:
        """현재까지 수신한 마지막 체결가 스냅샷 (구독자 초기 payload 용)"""
        return dict(self._latest)

    def publish(self, ticker: str, price: float) -> None:
        """실시간 체결가 브로드캐스트 (비동기, 논블로킹)"""
        sym = ticker.upper()
        self._latest[sym] = price
        payload: dict[str, Any] = {"type": "tick", "ticker": sym, "price": price}

        for queue in list(self._subscribers):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                # 가장 오래된 틱을 버리고 최신 틱으로 교체 (백프레셔 방지)
                try:
                    queue.get_nowait()
                    queue.put_nowait(payload)
                except Exception:
                    logger.warning(f"[PriceHub] {sym} 구독자 큐 갱신 실패")
            except Exception as e:  # pragma: no cover - 방어적 처리
                logger.warning(f"[PriceHub] {sym} 구독자 전달 실패: {e}")

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=_MAX_QUEUE_SIZE)
        self._subscribers.add(queue)
        logger.info(f"[PriceHub] 실시간 가격 구독자 등록 (총 {len(self._subscribers)}개)")
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(queue)
        logger.info(f"[PriceHub] 실시간 가격 구독자 해제 (잔여 {len(self._subscribers)}개)")


# 전역 단일 인스턴스 (라우터/WS 클라이언트가 공유)
price_hub = RealtimePriceHub()