"""
LogoWarmupService: 보고서 티커 기준 로고/한글명 캐시를 백그라운드로 점진 채움
"""
import asyncio
import logging
import time
from collections import deque

from app.domains.screener.logo_service import TickerLogoService
from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("logo_warmup_service")


class LogoWarmupService:
    def __init__(
        self,
        interval_sec: int = 60,
        max_seed_tickers: int = 2000,
        reseed_interval_sec: int = 30 * 60,
        failure_cooldown_sec: int = 24 * 60 * 60,
    ):
        self.interval_sec = interval_sec
        self.max_seed_tickers = max_seed_tickers
        self.reseed_interval_sec = reseed_interval_sec
        self.failure_cooldown_sec = failure_cooldown_sec
        self.logo_service = TickerLogoService()
        self._queue: deque[str] = deque()
        self._queued_set: set[str] = set()
        self._failed_until: dict[str, float] = {}
        self._last_seed_at: float = 0.0
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
        self._log_name_cache_status()
        await self._seed_from_reports()
        self._task = asyncio.create_task(self._run(), name="logo-warmup-loop")
        logger.info("[LogoWarmup] 백그라운드 로고 워밍업 시작")

    def _log_name_cache_status(self) -> None:
        """
        시작 시 종목 한글명 캐시 상태를 명확히 1회 로그로 남긴다.
        - korean_name 컬럼이 있으면: 캐시 활성(워밍업이 한글명을 채움)
        - 없으면: 캐시 비활성(마이그레이션 필요) — 이후 조용히 실패하지 않도록 상태를 고지
        """
        if not supabase_repo.is_connected():
            return
        try:
            # 프로브 조회: 컬럼이 없으면 내부 서킷브레이커가 올라가며 경고 1회 출력
            supabase_repo.get_ticker_names(["__PROBE__"])
        except Exception:
            pass
        if getattr(supabase_repo, "_korean_name_column_missing", False):
            logger.warning(
                "[LogoWarmup] 종목 한글명 캐시: 비활성 — ticker_logos.korean_name 컬럼이 없습니다. "
                "scripts/migration_ticker_korean_name.sql 을 Supabase SQL Editor에서 실행 후 "
                "서버를 재시작하면 한글명 워밍업이 동작합니다."
            )
        else:
            logger.info("[LogoWarmup] 종목 한글명 캐시: 활성")

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
        now = time.monotonic()
        async with self._lock:
            for ticker in tickers:
                normalized = self._normalize(ticker)
                if not normalized or normalized in self._queued_set:
                    continue
                # 최근 실패한 종목은 쿨다운이 끝날 때까지 재시도하지 않는다.
                failed_until = self._failed_until.get(normalized)
                if failed_until is not None:
                    if failed_until > now:
                        continue
                    self._failed_until.pop(normalized, None)
                self._queue.append(normalized)
                self._queued_set.add(normalized)

    async def _seed_from_reports(self) -> None:
        now = time.monotonic()
        if self._last_seed_at and now - self._last_seed_at < self.reseed_interval_sec:
            return
        self._last_seed_at = now
        report_tickers = supabase_repo.list_report_tickers(limit=self.max_seed_tickers)
        await self.enqueue_tickers(report_tickers)
        if report_tickers:
            logger.info(f"[LogoWarmup] 보고서 티커 시드 적재 완료: {len(report_tickers)}개")

    def _mark_failed(self, ticker: str) -> None:
        self._failed_until[ticker] = time.monotonic() + self.failure_cooldown_sec

    async def _pop_next(self) -> str | None:
        async with self._lock:
            if not self._queue:
                return None
            ticker = self._queue.popleft()
            self._queued_set.discard(ticker)
            return ticker

    async def _process_ticker(self, ticker: str) -> None:
        """한 종목의 로고/한글명 캐시를 채우고, 성공/실패에 따라 쿨다운을 갱신한다."""
        cached_logo = self.logo_service.get_cached_logo(ticker)
        cached_name = self.logo_service.get_cached_names([ticker]).get(ticker)
        # korean_name 컬럼 미적용 DB에서는 이름 조회/적재를 건너뛴다(헛 Toss 호출 방지).
        name_cache_enabled = not getattr(
            supabase_repo, "_korean_name_column_missing", False
        )
        logo_available = cached_logo is not None
        name_resolved = cached_name is not None

        if logo_available and (name_resolved or not name_cache_enabled):
            logger.debug(f"[LogoWarmup] 캐시 존재로 건너뜀: {ticker}")
            self._failed_until.pop(ticker, None)
            return

        logo_image_url, source = await self.logo_service.resolve_logo(ticker)
        if logo_image_url:
            logo_available = True
            logger.info(f"[LogoWarmup] 로고 갱신 완료: {ticker} ({source})")
        # 로고 조회 과정에서 한글명도 같이 저장되지만,
        # 로고가 이미 있어 resolve가 cached로 끝난 경우 한글명만 별도 보충
        if not cached_name and name_cache_enabled:
            korean_name, name_source = await self.logo_service.resolve_name(ticker)
            if korean_name:
                name_resolved = True
                logger.info(f"[LogoWarmup] 한글명 갱신 완료: {ticker} {korean_name} ({name_source})")

        if logo_available or (name_cache_enabled and name_resolved):
            # 성공한 종목은 실패 쿨다운 기록을 해제한다.
            self._failed_until.pop(ticker, None)
        else:
            # 아무것도 못 찾은 종목은 쿨다운 동안 재시도하지 않도록 기록한다.
            # (Toss 400 등 외부 오류로 같은 종목을 매 분 재조회하는 것을 방지)
            logger.info(f"[LogoWarmup] 로고/한글명 미발견: {ticker}")
            self._mark_failed(ticker)

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            ticker: str | None = None
            try:
                ticker = await self._pop_next()
                if not ticker:
                    await self._seed_from_reports()
                else:
                    await self._process_ticker(ticker)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.warning(f"[LogoWarmup] 워밍업 중 오류: {e}")
                if ticker:
                    self._mark_failed(ticker)

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_sec)
            except asyncio.TimeoutError:
                continue


logo_warmup_service = LogoWarmupService()
