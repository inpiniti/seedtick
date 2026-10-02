"""
TossIpGuard: 토스 Open API 허용 IP 미등록(403) 상태를 프로세스 전역으로 기억하는 가드

토스 Open API는 서버 공인 IP가 WTS 허용 IP에 등록되어 있지 않으면 모든 요청에
403을 반환한다. 사용자가 WTS에서 IP를 등록하기 전까지는 몇 번을 재시도해도 성공하지
않으므로, 최초 403을 감지한 뒤에는 외부 요청을 즉시 단락(short-circuit)시켜
불필요한 API 호출/WebSocket 재연결 폭주를 막는다.

사용자가 IP를 등록한 뒤 관리 화면에서 "다시 연결"을 누르면 `clear()`로 차단을 풀고
1회 실제 프로브를 수행한다. 성공하면 정상 동작을 재개하고, 다시 403이면 재차단한다.
"""
import asyncio
import contextlib
import logging
import threading
import time
from typing import Any

logger = logging.getLogger("toss_ip_guard")


class TossIpBlockedError(PermissionError):
    """토스 허용 IP 미등록으로 인해 요청이 차단된 상태"""


class TossIpGuard:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._blocked = False
        self._blocked_at: float | None = None
        self._reason: str | None = None
        self._block_count = 0
        # 이벤트 루프별 unblock 이벤트 (테스트 등 루프 재생성 환경 대비)
        self._unblock_events: dict[Any, asyncio.Event] = {}

    @property
    def is_blocked(self) -> bool:
        return self._blocked

    def mark_blocked(self, reason: str) -> None:
        """허용 IP 미등록(403) 감지 → 외부 요청 차단 시작 (최초 1회만 경고 로그)"""
        with self._lock:
            first = not self._blocked
            self._blocked = True
            if self._blocked_at is None:
                self._blocked_at = time.time()
            self._reason = reason
            self._block_count += 1
        if first:
            logger.warning(
                "[TossIpGuard] 🔒 토스 허용 IP 미등록(403) 감지 — 토스 API 호출을 중단합니다. "
                "WTS에 IP를 등록한 뒤 관리 화면에서 '다시 연결'을 눌러주세요."
            )

    def clear(self) -> None:
        """차단 해제 → 대기 중인 WebSocket 루프를 깨워 정상 동작 재개"""
        with self._lock:
            was_blocked = self._blocked
            self._blocked = False
            self._blocked_at = None
            self._reason = None
            events = list(self._unblock_events.items())
        if was_blocked:
            logger.info("[TossIpGuard] 🔓 토스 허용 IP 차단 해제 — 정상 동작을 재개합니다.")
        for loop, ev in events:
            # 닫힌 이벤트 루프(테스트 등)의 이벤트는 정리하고 건너뛴다.
            if loop.is_closed():
                self._unblock_events.pop(loop, None)
                continue
            try:
                ev.set()
            except Exception:
                pass

    def ensure_allowed(self) -> None:
        """차단 상태면 외부 요청을 보내지 않고 즉시 실패시킨다."""
        if self._blocked:
            raise TossIpBlockedError(
                self._reason or "토스 허용 IP 미등록 상태라 요청을 보내지 않았어요."
            )

    def _unblock_event(self) -> asyncio.Event:
        loop = asyncio.get_running_loop()
        ev = self._unblock_events.get(loop)
        if ev is None:
            ev = asyncio.Event()
            self._unblock_events[loop] = ev
        return ev

    async def wait_until_unblocked(self, timeout: float = 60.0) -> None:
        """차단이 풀릴 때까지 대기한다. 메모리 상태만 확인하며 외부 요청은 보내지 않는다."""
        if not self._blocked:
            return
        ev = self._unblock_event()
        ev.clear()
        # clear() 가 check 와 wait 사이에 끼어든 경우를 재확인
        if not self._blocked:
            return
        with contextlib.suppress(asyncio.TimeoutError):
            await asyncio.wait_for(ev.wait(), timeout=timeout)

    def snapshot(self) -> dict[str, Any]:
        return {
            "blocked": self._blocked,
            "blocked_at": self._blocked_at,
            "reason": self._reason,
            "block_count": self._block_count,
        }


# 전역 단일 인스턴스 (어댑터 / WebSocket 클라이언트 / 라우터가 공유)
toss_ip_guard = TossIpGuard()