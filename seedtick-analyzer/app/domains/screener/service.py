"""
ScreenerService: 토스증권 13인의 거장 '공통' 스크리너 직접 호출
"""
import logging
from app.domains.screener.models import ScreenCriteria, ScreenResult, TossStockItem
from app.domains.screener.clients.toss_wts import TossWtsClient

logger = logging.getLogger("screener_service")


class ScreenerService:
    def __init__(self, wts_client: TossWtsClient | None = None):
        self.wts_client = wts_client or TossWtsClient()

    async def get_stock_list(
        self, criteria: ScreenCriteria | None = None
    ) -> ScreenResult:
        """
        토스증권 WTS API 직접 호출:
        13인의 거장 '공통' 필터로 미국 주식 스크리닝 (시총 3000억↑, 부채비율 100%↓, ROE 10%↑ 등)
        """
        crit = criteria or ScreenCriteria()
        logger.info(f"[Screener] 토스 WTS 직접 호출 시작 (nation={crit.nation}, size={crit.size})")

        try:
            raw_data = await self.wts_client.screen_common_us(
                size=crit.size,
                page=crit.page,
            )
            logger.info(f"[Screener] 토스 WTS 직접 호출 성공: {len(raw_data.get('stocks', []))}개 종목 반환")
        except Exception as e:
            logger.error(f"[Screener] 토스 WTS 직접 호출 실패: {e}")
            raise RuntimeError(f"토스 스크리너 직접 조회 실패: {e}") from e

        stocks = raw_data.get("stocks") or []
        items: list[TossStockItem] = []
        exclude_set = set(crit.exclude_tickers)

        for s in stocks:
            ticker = s.get("ticker")
            if not ticker or ticker in exclude_set:
                continue

            item = TossStockItem(
                ticker=ticker,
                stock_code=s.get("stockCode") or "",
                name=s.get("name") or ticker,
                price=s.get("price"),
                prev_close=s.get("prevClose"),
                market_cap=s.get("시가총액"),
                debt_ratio=s.get("부채_비율"),
                interest_coverage=s.get("이자_보상_배율"),
                operating_margin=s.get("영업_이익률"),
                roe=s.get("ROE"),
                logo_image_url=s.get("logoImageUrl"),
            )
            items.append(item)

        return ScreenResult(
            tickers=items,
            total_count=raw_data.get("totalCount", len(items)),
            count=len(items),
            criteria=crit,
            source="toss_wts_direct",
        )
