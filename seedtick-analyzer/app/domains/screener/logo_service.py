"""
TickerLogoService: 티커별 로고 캐시 조회 및 Toss 조회 폴백
"""
import asyncio
import logging

from app.domains.screener.clients.toss_wts import TossWtsClient
from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("ticker_logo_service")

# 일괄 조회 시 Toss API 병렬 상한 (공유 AsyncClient 토큰 경합 방지 위해 보수적으로)
_RESOLVE_CONCURRENCY = 5


class TickerLogoService:
    def __init__(
        self,
        wts_client: TossWtsClient | None = None,
    ):
        self.wts_client = wts_client or TossWtsClient()

    @staticmethod
    def _normalize_ticker(ticker: str) -> str:
        return (ticker or "").strip().upper()

    @staticmethod
    def _is_valid_logo_url(logo_image_url: str | None) -> bool:
        if not logo_image_url:
            return False
        normalized = logo_image_url.strip().lower()
        return normalized.startswith("http://") or normalized.startswith("https://")

    def get_cached_logo(self, ticker: str) -> str | None:
        normalized = self._normalize_ticker(ticker)
        if not normalized:
            return None
        cached = supabase_repo.get_ticker_logo(normalized)
        if self._is_valid_logo_url(cached):
            return cached
        return None

    def get_cached_logos(self, tickers: list[str]) -> dict[str, str]:
        return supabase_repo.get_ticker_logos(tickers)

    def save_logo(
        self,
        ticker: str,
        logo_image_url: str | None,
        stock_code: str | None = None,
        source: str = "toss_screener",
        korean_name: str | None = None,
    ) -> None:
        if not self._is_valid_logo_url(logo_image_url) and not (korean_name or "").strip():
            return
        supabase_repo.upsert_ticker_logo(
            ticker=ticker,
            logo_image_url=logo_image_url,
            stock_code=stock_code,
            source=source,
            korean_name=korean_name,
        )

    def save_logos_batch(self, items: list[dict]) -> None:
        """복수 티커 로고 URL/한글명 일괄 캐시 저장"""
        if not items:
            return
        valid_items = [
            it
            for it in items
            if self._is_valid_logo_url(it.get("logo_image_url"))
            or (it.get("korean_name") or "").strip()
        ]
        if valid_items:
            supabase_repo.upsert_ticker_logos(valid_items)

    def get_cached_names(self, tickers: list[str]) -> dict[str, str]:
        return supabase_repo.get_ticker_names(tickers)


    async def resolve_logo(self, ticker: str) -> tuple[str | None, str]:
        """
        순서:
        1) Supabase ticker_logos 캐시
        2) Toss 공통 스크리너 탐색 조회 후 캐시 저장
        """
        normalized = self._normalize_ticker(ticker)
        if not normalized:
            return None, "none"

        cached = self.get_cached_logo(normalized)
        if cached:
            return cached, "cached"

        found = await self.wts_client.find_logo_by_ticker(normalized)
        if not found:
            return None, "none"

        logo_image_url = found.get("logo_image_url")
        stock_code = found.get("stock_code")
        korean_name = (found.get("korean_name") or "").strip() or None
        if self._is_valid_logo_url(logo_image_url) or korean_name:
            self.save_logo(
                ticker=normalized,
                logo_image_url=logo_image_url,
                stock_code=stock_code,
                source="toss_lookup",
                korean_name=korean_name,
            )
            if self._is_valid_logo_url(logo_image_url):
                return logo_image_url, "toss_lookup"

        return None, "none"

    async def resolve_name(self, ticker: str) -> tuple[str | None, str]:
        """
        한글명 조회 순서:
        1) Supabase ticker_logos.korean_name 캐시
        2) Toss 검색/상세/스크리너 탐색 조회 후 캐시 저장
        """
        normalized = self._normalize_ticker(ticker)
        if not normalized:
            return None, "none"

        cached = self.get_cached_names([normalized]).get(normalized)
        if cached:
            return cached, "cached"

        found = await self.wts_client.find_logo_by_ticker(normalized)
        if not found:
            return None, "none"

        korean_name = (found.get("korean_name") or "").strip() or None
        if korean_name:
            self.save_logo(
                ticker=normalized,
                logo_image_url=found.get("logo_image_url"),
                stock_code=found.get("stock_code"),
                source="toss_lookup",
                korean_name=korean_name,
            )
            return korean_name, "toss_lookup"

        return None, "none"

    async def resolve_names(
        self,
        tickers: list[str],
        max_count: int = 30,
    ) -> list[tuple[str, str | None, str]]:
        """
        여러 티커 한글명을 조회한다.
        - 호출량 제어를 위해 max_count 상한 적용
        - Supabase 배치 캐시 선조회 후 미적중분만 병렬 조회
        - 반환: (ticker, korean_name, source)
        """
        normalized_unique: list[str] = []
        seen: set[str] = set()
        for ticker in tickers:
            normalized = self._normalize_ticker(ticker)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            normalized_unique.append(normalized)
            if len(normalized_unique) >= max_count:
                break

        try:
            cached = self.get_cached_names(normalized_unique)
        except Exception as e:
            logger.warning(f"[TickerLogo] 한글명 배치 캐시 조회 실패: {e}")
            cached = {}
        misses = [t for t in normalized_unique if not cached.get(t)]

        sem = asyncio.Semaphore(_RESOLVE_CONCURRENCY)

        async def _resolve_one(ticker: str) -> tuple[str, str | None, str]:
            async with sem:
                try:
                    korean_name, source = await self.resolve_name(ticker)
                except Exception as e:
                    logger.warning(f"[TickerLogo] 한글명 조회 실패 ({ticker}): {e}")
                    return ticker, None, "none"
                return ticker, korean_name, source

        resolved = await asyncio.gather(*(_resolve_one(t) for t in misses))
        by_ticker: dict[str, tuple[str | None, str]] = {
            t: (name, "cached") for t, name in cached.items()
        }
        for ticker, korean_name, source in resolved:
            by_ticker[ticker] = (korean_name, source)
        return [(t, *by_ticker[t]) for t in normalized_unique]

    async def resolve_logos(
        self,
        tickers: list[str],
        max_count: int = 12,
    ) -> list[tuple[str, str | None, str]]:
        """
        여러 티커 로고를 조회한다.
        - 호출량 제어를 위해 max_count 상한 적용
        - Supabase 배치 캐시 선조회 후 미적중분만 병렬 조회
        - 반환: (ticker, logo_image_url, source)
        """
        normalized_unique: list[str] = []
        seen: set[str] = set()
        for ticker in tickers:
            normalized = self._normalize_ticker(ticker)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            normalized_unique.append(normalized)
            if len(normalized_unique) >= max_count:
                break

        try:
            cached = self.get_cached_logos(normalized_unique)
        except Exception as e:
            logger.warning(f"[TickerLogo] 로고 배치 캐시 조회 실패: {e}")
            cached = {}
        misses = [t for t in normalized_unique if t not in cached]

        sem = asyncio.Semaphore(_RESOLVE_CONCURRENCY)

        async def _resolve_one(ticker: str) -> tuple[str, str | None, str]:
            async with sem:
                try:
                    logo_image_url, source = await self.resolve_logo(ticker)
                except Exception as e:
                    logger.warning(f"[TickerLogo] 로고 조회 실패 ({ticker}): {e}")
                    return ticker, None, "none"
                return ticker, logo_image_url, source

        resolved = await asyncio.gather(*(_resolve_one(t) for t in misses))
        by_ticker: dict[str, tuple[str | None, str]] = {
            t: (url, "cached") for t, url in cached.items()
        }
        for ticker, logo_image_url, source in resolved:
            by_ticker[ticker] = (logo_image_url, source)
        return [(t, *by_ticker[t]) for t in normalized_unique]
