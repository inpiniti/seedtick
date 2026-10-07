"""
TickerLogoService: 티커별 로고 캐시 조회 및 Toss 조회 폴백
"""
import logging

from app.domains.screener.clients.toss_wts import TossWtsClient
from app.infrastructure.supabase_repo import supabase_repo

logger = logging.getLogger("ticker_logo_service")


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
        logo_image_url: str,
        stock_code: str | None = None,
        source: str = "toss_screener",
    ) -> None:
        if not self._is_valid_logo_url(logo_image_url):
            return
        supabase_repo.upsert_ticker_logo(
            ticker=ticker,
            logo_image_url=logo_image_url,
            stock_code=stock_code,
            source=source,
        )

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
        if self._is_valid_logo_url(logo_image_url):
            self.save_logo(
                ticker=normalized,
                logo_image_url=logo_image_url,
                stock_code=stock_code,
                source="toss_lookup",
            )
            return logo_image_url, "toss_lookup"

        return None, "none"

    async def resolve_logos(
        self,
        tickers: list[str],
        max_count: int = 12,
    ) -> list[tuple[str, str | None, str]]:
        """
        여러 티커 로고를 순차 조회한다.
        - 호출량 제어를 위해 max_count 상한 적용
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

        results: list[tuple[str, str | None, str]] = []
        for ticker in normalized_unique:
            logo_image_url, source = await self.resolve_logo(ticker)
            results.append((ticker, logo_image_url, source))
        return results
