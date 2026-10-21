"""
PipelineCoordinator: 일일 배치와 온디맨드 분석 간의 우선순위 및 일시정지(Yield) 코디네이터

- 정기 배치가 실행 중일 때 사용자의 긴급 온디맨드 분석 요청이 들어오면
  일일 배치의 다음 종목 진입을 안전하게 일시정지(pause)하고 온디맨드 요청에 서버 자원을 우선 배정합니다.
- 온디맨드 분석이 완료되면 배치를 자동으로 재개(resume)합니다.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging

logger = logging.getLogger("pipeline_coordinator")


class PipelineCoordinator:
    def __init__(self) -> None:
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # 기본 상태: 진행 가능 (Not paused)
        self._active_ondemand_count: int = 0
        self._lock = asyncio.Lock()

    @property
    def is_paused(self) -> bool:
        """현재 일일 배치가 일시정지 상태인지 여부"""
        return not self._pause_event.is_set()

    @property
    def active_ondemand_count(self) -> int:
        """현재 처리 중인 온디맨드 요청 수"""
        return self._active_ondemand_count

    async def wait_if_paused(self) -> None:
        """
        일일 배치의 각 단계 및 종목 진입 전 호출:
        온디맨드 요청이 실행 중이면 완료될 때까지 대기합니다.
        """
        if not self._pause_event.is_set():
            logger.info("[Coordinator] 온디맨드 우선 처리를 위해 일일 배치가 대기 중입니다...")
        await self._pause_event.wait()

    @contextlib.asynccontextmanager
    async def ondemand_scope(self, ticker: str):
        """
        온디맨드 분석 실행 블록을 감싸는 비동기 컨텍스트 매니저.
        - 진입: 배치를 일시 정지 신호로 전환
        - 종료: 온디맨드가 모두 끝나면 배치 재개 신호 발동
        """
        clean_ticker = ticker.upper().strip()
        async with self._lock:
            self._active_ondemand_count += 1
            if self._active_ondemand_count == 1:
                self._pause_event.clear()
                logger.warning(
                    f"⚡ [Coordinator] 온디맨드 긴급 분석([{clean_ticker}]) 인입 -> 일일 배치 일시정지 신호 발동"
                )

        try:
            yield
        finally:
            async with self._lock:
                self._active_ondemand_count = max(0, self._active_ondemand_count - 1)
                if self._active_ondemand_count == 0:
                    self._pause_event.set()
                    logger.info(
                        f"▶️ [Coordinator] 온디맨드 분석([{clean_ticker}]) 완료 -> 일일 배치 재개 신호 발동"
                    )


# 전역 싱글톤 코디네이터
pipeline_coordinator = PipelineCoordinator()
