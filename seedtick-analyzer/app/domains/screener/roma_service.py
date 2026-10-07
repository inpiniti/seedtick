"""
RomaScreenerService: DataRoma Grand Portfolio 기반 두번째 스크리너

- 13인 거장(토스) 스크리너와 구분되는 "슈퍼인베스터 공동 보유" 관점 스크리닝
- 소유자 수(Ownership count) 10명 이상 종목만 대상으로 선별
- 결과는 기존 스크리너와 동일한 ScreenResult/TossStockItem 형태로 반환하여
  리포트 파이프라인 및 어드민 UI가 그대로 재사용 가능
"""
import logging

from app.domains.screener.clients.dataroma import (
    MIN_HOLDERS_DEFAULT,
    DataromaClient,
)
from app.domains.screener.logo_service import TickerLogoService
from app.domains.screener.models import ScreenCriteria, ScreenResult, TossStockItem

logger = logging.getLogger("roma_screener_service")

ROMA_PRESET = "roma"
ROMA_SOURCE = "dataroma_grand_portfolio"


class RomaScreenerService:
    """DataRoma 그랜드 포트폴리오 스크리닝 서비스"""

    def __init__(
        self,
        client: DataromaClient | None = None,
        logo_service: TickerLogoService | None = None,
    ):
        self.client = client or DataromaClient()
        self.logo_service = logo_service or TickerLogoService()

    async def get_stock_list(
        self,
        min_holders: int = MIN_HOLDERS_DEFAULT,
        size: int = 0,
    ) -> ScreenResult:
        """
        슈퍼인베스터 보유 종목 스크리닝:

        Args:
            min_holders: 최소 보유 투자자 수 (기본 10명)
            size: 결과 상한 (0 이하면 전체)

        Raises:
            RuntimeError: 조회/파싱 실패 또는 결과가 비어 있는 경우
        """
        criteria = ScreenCriteria(preset=ROMA_PRESET, nation="us", size=size or 200)
        logger.info(
            f"[Roma] DataRoma 스크리너 조회 시작 (min_holders={min_holders}, size={size or '전체'})"
        )

        try:
            rows = await self.client.fetch_grand_portfolio(min_holders=min_holders)
        except Exception as e:
            logger.error(f"[Roma] DataRoma 포트폴리오 조회 실패: {e}")
            raise RuntimeError(f"DataRoma 슈퍼인베스터 포트폴리오 조회 실패: {e}") from e

        if not rows:
            raise RuntimeError(
                f"DataRoma 스크리닝 결과가 비어 있습니다 (min_holders={min_holders})."
            )

        items = [
            TossStockItem(
                ticker=row["ticker"],
                stock_code=row["ticker"],
                name=row["name"] or row["ticker"],
                price=row.get("price"),
                screeners=[ROMA_PRESET],
                holders=row.get("holders"),
                weight_pct=row.get("weight_pct"),
                hold_price=row.get("hold_price"),
                week52_low=row.get("week52_low"),
                week52_high=row.get("week52_high"),
            )
            for row in rows
        ]

        if size and size > 0:
            items = items[:size]

        self._hydrate_cached_logos(items)
        logger.info(f"[Roma] 스크리닝 통과 종목: 총 {len(items)}개")
        return ScreenResult(
            tickers=items,
            items=items,
            total_count=len(items),
            count=len(items),
            criteria=criteria,
            source=ROMA_SOURCE,
        )

    def _hydrate_cached_logos(self, items: list[TossStockItem]) -> None:
        tickers = [item.ticker for item in items if item.ticker and not item.logo_image_url]
        if not tickers:
            return

        cached = self.logo_service.get_cached_logos(tickers)
        for item in items:
            if item.logo_image_url:
                continue
            logo = cached.get((item.ticker or "").upper())
            if logo and (logo.startswith("http://") or logo.startswith("https://")):
                item.logo_image_url = logo
