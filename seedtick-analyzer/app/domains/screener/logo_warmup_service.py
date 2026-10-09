"""
LogoWarmupService: 보고서 티커 기준 로고/한글명 캐시를 백그라운드로 점진 채움
"""
import asyncio
import logging
from collections import deque

from app.domains.screener.logo_service import TickerLogoService
from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("logo_warmup_service")


class LogoWarmupService:
    def __init__(
        self,
        interval_sec: int = 60,
        max_seed_tickers: int = 2000,
    ):
        self.interval_sec = interval_sec
        self.max_seed_tickers = max_seed_tickers
        self.logo_service = TickerLogoService()
        self._queue: deque[str] = deque()
        self._queued_set: set[str] = set()
        self._lock = asyncio.Lock()
        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()

    @staticmethod
    def _normalize(ticker: str) -> str:
        return (ticker or "").strip().upper()

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        await self._seed_from_reports()
        self._task = asyncio.create_task(self._run(), name="logo-warmup-loop")
        logger.info("[LogoWarmup] 백그라운드 로고 워밍업 시작")

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("[LogoWarmup] 백그라운드 로고 워밍업 종료")

    async def enqueue_tickers(self, tickers: list[str]) -> None:
        if not tickers:
            return
        async with self._lock:
            for ticker in tickers:
                normalized = self._normalize(ticker)
                if not normalized or normalized in self._queued_set:
                    continue
                self._queue.append(normalized)
                self._queued_set.add(normalized)

    async def _seed_from_reports(self) -> None:
        report_tickers = supabase_repo.list_report_tickers(limit=self.max_seed_tickers)
        await self.enqueue_tickers(report_tickers)
        if report_tickers:
            logger.info(f"[LogoWarmup] 보고서 티커 시드 적재 완료: {len(report_tickers)}개")

    async def _pop_next(self) -> str | None:
        async with self._lock:
            if not self._queue:
                return None
            ticker = self._queue.popleft()
            self._queued_set.discard(ticker)
            return ticker

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                ticker = await self._pop_next()
                if not ticker:
                    await self._seed_from_reports()
                else:
                    cached_logo = self.logo_service.get_cached_logo(ticker)
                    cached_name = self.logo_service.get_cached_names([ticker]).get(ticker)
                    # korean_name 컬럼 미적용 DB에서는 이름 조회/적재를 건너뛴다(헛 Toss 호출 방지).
                    name_cache_enabled = not getattr(
                        supabase_repo, "_korean_name_column_missing", False
                    )
                    if cached_logo and (cached_name or not name_cache_enabled):
                        logger.debug(f"[LogoWarmup] 캐시 존재로 건너뜀: {ticker}")
                    else:
                        logo_image_url, source = await self.logo_service.resolve_logo(ticker)
                        # 로고 조회 과정에서 한글명도 같이 저장되지만,
                        # 로고가 이미 있어 resolve가 cached로 끝난 경우 한글명만 별도 보충
                        if not cached_name and name_cache_enabled:
                            korean_name, name_source = await self.logo_service.resolve_name(ticker)
                            if korean_name:
                                logger.info(f"[LogoWarmup] 한글명 갱신 완료: {ticker} {korean_name} ({name_source})")
                        if logo_image_url:
                            logger.info(f"[LogoWarmup] 로고 갱신 완료: {ticker} ({source})")
                        elif not cached_name and name_cache_enabled:
                            logger.info(f"[LogoWarmup] 로고/한글명 미발견: {ticker}")
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning(f"[LogoWarmup] 워밍업 중 오류: {e}")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_sec)
            except asyncio.TimeoutError:
                continue


logo_warmup_service = LogoWarmupService()
