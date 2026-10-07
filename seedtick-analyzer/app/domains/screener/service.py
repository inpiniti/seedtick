"""
ScreenerService: 토스증권 13인의 거장 스크리너 직접 연동
- 종합(공통) + 12인 거장 스크리너 직접 통합 조회 (필립 피셔 제외)
- 종합 및 12인 거장 간 중복 티커 제거 및 단일 유니버스 생성
- 외부 프록시(hf.space) 없이 Toss WTS 비공개 API 직접 호출
"""
import logging
from typing import Any
from app.config.constants import EXCLUDED_SCREENER_GURUS, SCREENER_12_GURUS
from app.domains.screener.logo_service import TickerLogoService
from app.domains.screener.clients.toss_wts import TossWtsClient
from app.domains.screener.models import ScreenCriteria, ScreenResult, TossStockItem

logger = logging.getLogger("screener_service")


class ScreenerService:
    def __init__(
        self,
        wts_client: TossWtsClient | None = None,
        btc_client: Any = None,
        logo_service: TickerLogoService | None = None,
    ):
        # Toss WTS 비공개 API 직접 호출 클라이언트가 기본 클라이언트
        self.wts_client = wts_client or btc_client or TossWtsClient()
        self.btc_client = self.wts_client
        self.logo_service = logo_service or TickerLogoService(wts_client=self.wts_client)

    async def get_stock_list(
        self, criteria: ScreenCriteria | None = None
    ) -> ScreenResult:
        """
        스크리너 주식 목록 조회:
        - preset이 '공통', '종합', 'all', '전체'인 경우:
          종합(공통) + 12인 거장 스크리너를 직접 병렬 조회하여 중복 티커를 제거하고 단일 리스트로 반환 (피셔 제외)
        - 특정 거장 지정 시: 해당 거장 단일 조회 (피셔인 경우 빈 결과)
        - 거장 통합 조회 실패 시 Toss WTS 공통 필터 직접 호출로 안전하게 폴백
        """
        crit = criteria or ScreenCriteria()
        preset = (crit.preset or "공통").strip()
        logger.info(
            f"[Screener] 스크리너 조회 시작 (preset={preset}, nation={crit.nation}, size={crit.size})"
        )

        # 1. 제외 대상 거장 (필립 피셔: 조회 종목 과다) 처리
        if preset in EXCLUDED_SCREENER_GURUS:
            logger.warning(
                f"[Screener] 과다 조회로 제외된 거장('{preset}')이 요청되었습니다. 빈 목록을 반환합니다."
            )
            return ScreenResult(
                tickers=[],
                items=[],
                total_count=0,
                count=0,
                criteria=crit,
                source="screener_excluded",
            )

        # 2. 토스 WTS 직접 거장 스크리너 조회
        try:
            if crit.nation.lower() == "kr":
                return await self._get_kr_stocks(crit)
            elif preset in ("공통", "종합", "all", "전체"):
                return await self._get_combined_guru_stocks(crit)
            else:
                return await self._get_single_guru_stock(crit, preset)
        except Exception as e:
            logger.error(f"[Screener] 토스 거장 스크리너 조회 오류, 공통 필터 직접 호출로 폴백: {e}")

        # 3. 폴백: Toss WTS 공통 필터 직접 호출
        return await self._get_via_wts(crit)

    async def _get_kr_stocks(self, crit: ScreenCriteria) -> ScreenResult:
        """
        한국장 스크리너:
        - 미국장(12인 거장 병렬 조회 및 합집합)과 달리, 단일 '공통' 기준을 바탕으로 함.
        - 조건 강화 옵션(tighten_step: 0~5단계 및 그 이상)을 적용하여 100개 이상의 과다 조회를 압축.
        """
        step = max(0, crit.tighten_step)
        logger.info(
            f"[Screener] 한국장 스크리너 조회 시작 (tighten_step={step}, size={crit.size}, page={crit.page})"
        )
        raw_data = await self.wts_client.screen_kr_common(
            step=step,
            size=crit.size,
            page=crit.page,
        )
        stocks = raw_data.get("stocks") or []
        exclude_set = set(crit.exclude_tickers)
        items: list[TossStockItem] = []

        step_label = f"조건강화 {step}단계" if step > 0 else "공통 기본"

        for s in stocks:
            ticker = s.get("ticker")
            if not ticker or ticker in exclude_set:
                continue

            price = s.get("price")
            prev_close = s.get("prevClose")
            change_rate = None
            if price is not None and prev_close and prev_close > 0:
                change_rate = round(((price - prev_close) / prev_close) * 100, 2)

            item = TossStockItem(
                ticker=ticker,
                stock_code=s.get("stockCode") or "",
                name=s.get("name") or ticker,
                price=price,
                prev_close=prev_close,
                change_rate=change_rate,
                market_cap=s.get("시가총액"),
                debt_ratio=s.get("부채_비율") or s.get("부채비율"),
                interest_coverage=s.get("이자_보상_배율") or s.get("이자보상배율"),
                operating_margin=s.get("영업_이익률") or s.get("영업이익률"),
                roe=s.get("ROE"),
                logo_image_url=s.get("logoImageUrl"),
                screeners=["종합", step_label] if step > 0 else ["종합"],
                nation="kr",
                category=s.get("category"),
                tighten_step=step,
            )
            items.append(item)

        final_items = (
            items[: crit.size]
            if crit.size and len(items) > crit.size
            else items
        )

        self._cache_logo_items(final_items)

        total_count = raw_data.get("totalCount", len(items))
        logger.info(
            f"[Screener] 한국장 스크리너 완료: 총 {total_count}개 중 {len(final_items)}개 반환 (step={step})"
        )

        return ScreenResult(
            tickers=final_items,
            items=final_items,
            total_count=total_count,
            count=len(final_items),
            criteria=crit,
            source="toss_wts_kr",
        )

    async def _get_combined_guru_stocks(self, crit: ScreenCriteria) -> ScreenResult:
        """
        종합('공통') + 12인 거장 스크리너 직접 병렬 호출 및 중복 티커 제거
        (필립 피셔는 제외)
        """
        client = self.wts_client or self.btc_client
        assert client is not None
        gurus_to_query = ["공통"] + SCREENER_12_GURUS
        logger.info(
            f"[Screener] 종합 + 12인 거장 통합 스크리닝 시작 (총 {len(gurus_to_query)}개 프리셋 직접 병렬 호출, 피셔 제외)"
        )

        results = await client.get_all_gurus_screeners(
            gurus=gurus_to_query,
            nation=crit.nation,
            size=crit.size,
            page=crit.page,
        )

        # 결과 유효성 점검: 적어도 하나의 거장 결과에서 종목이 조회되었는지 확인
        has_any_stock = any(
            not isinstance(r, Exception) and len(r.get("stocks", [])) > 0
            for _, r in results
        )
        if not has_any_stock:
            raise RuntimeError("모든 거장 스크리너 조회에서 유효한 종목을 가져오지 못했습니다.")

        exclude_set = set(crit.exclude_tickers)
        seen_tickers: dict[str, TossStockItem] = {}
        ordered_items: list[TossStockItem] = []

        # 프리셋 호출 순서대로 순회 (공통/종합 우선, 이후 12인 거장 순서)
        for guru_key, res in results:
            if isinstance(res, Exception):
                logger.warning(f"[Screener] 거장 '{guru_key}' 응답 오류 (건너뜀): {res}")
                continue

            stocks = res.get("stocks") or []
            guru_label = "종합" if guru_key == "공통" else guru_key

            for s in stocks:
                ticker = s.get("ticker")
                if not ticker or ticker in exclude_set:
                    continue

                if ticker in seen_tickers:
                    # 중복 티커는 새로 추가하지 않고 버리며, 매칭된 스크리너 라벨만 추가
                    existing = seen_tickers[ticker]
                    if guru_label not in existing.screeners:
                        existing.screeners.append(guru_label)
                    # 누락된 데이터 보강
                    self._enrich_item_fields(existing, s)
                    continue

                price = s.get("price")
                prev_close = s.get("prevClose")
                change_rate = None
                if price is not None and prev_close and prev_close > 0:
                    change_rate = round(((price - prev_close) / prev_close) * 100, 2)

                item = TossStockItem(
                    ticker=ticker,
                    stock_code=s.get("stockCode") or "",
                    name=s.get("name") or ticker,
                    price=price,
                    prev_close=prev_close,
                    change_rate=change_rate,
                    market_cap=s.get("시가총액"),
                    debt_ratio=s.get("부채_비율") or s.get("부채비율"),
                    interest_coverage=s.get("이자_보상_배율") or s.get("이자보상배율"),
                    operating_margin=s.get("영업_이익률") or s.get("영업이익률"),
                    roe=s.get("ROE"),
                    logo_image_url=s.get("logoImageUrl"),
                    screeners=[guru_label],
                )
                seen_tickers[ticker] = item
                ordered_items.append(item)

        final_items = (
            ordered_items[: crit.size]
            if crit.size and len(ordered_items) > crit.size
            else ordered_items
        )

        logger.info(
            f"[Screener] 종합 + 12인 통합 스크리닝 완료: 총 {len(ordered_items)}개 고유 종목 발굴 (중복 제거 완료)"
        )
        self._cache_logo_items(final_items)

        return ScreenResult(
            tickers=final_items,
            items=final_items,
            total_count=len(ordered_items),
            count=len(final_items),
            criteria=crit,
            source="toss_wts_combined",
        )

    async def _get_single_guru_stock(
        self, crit: ScreenCriteria, preset: str
    ) -> ScreenResult:
        """단일 특정 거장 스크리너 직접 조회"""
        client = self.wts_client or self.btc_client
        assert client is not None
        logger.info(f"[Screener] 단일 거장 '{preset}' 직접 스크리닝 시작")
        raw_data = await client.get_guru_screener(
            guru=preset,
            nation=crit.nation,
            size=crit.size,
            page=crit.page,
        )
        stocks = raw_data.get("stocks") or []
        exclude_set = set(crit.exclude_tickers)
        items: list[TossStockItem] = []

        for s in stocks:
            ticker = s.get("ticker")
            if not ticker or ticker in exclude_set:
                continue

            price = s.get("price")
            prev_close = s.get("prevClose")
            change_rate = None
            if price is not None and prev_close and prev_close > 0:
                change_rate = round(((price - prev_close) / prev_close) * 100, 2)

            item = TossStockItem(
                ticker=ticker,
                stock_code=s.get("stockCode") or "",
                name=s.get("name") or ticker,
                price=price,
                prev_close=prev_close,
                change_rate=change_rate,
                market_cap=s.get("시가총액"),
                debt_ratio=s.get("부채_비율") or s.get("부채비율"),
                interest_coverage=s.get("이자_보상_배율") or s.get("이자보상배율"),
                operating_margin=s.get("영업_이익률") or s.get("영업이익률"),
                roe=s.get("ROE"),
                logo_image_url=s.get("logoImageUrl"),
                screeners=[preset],
            )
            items.append(item)

        self._cache_logo_items(items)

        return ScreenResult(
            tickers=items,
            items=items,
            total_count=raw_data.get("totalCount", len(items)),
            count=len(items),
            criteria=crit,
            source="toss_wts_single",
        )

    async def _get_via_wts(self, crit: ScreenCriteria) -> ScreenResult:
        """폴백: 토스 WTS 직접 호출 (공통 필터)"""
        logger.info(
            f"[Screener] 토스 WTS 직접 호출 시작 (nation={crit.nation}, size={crit.size})"
        )
        try:
            raw_data = await self.wts_client.screen_common(
                nation=crit.nation,
                size=crit.size,
                page=crit.page,
            )
            logger.info(
                f"[Screener] 토스 WTS 직접 호출 성공: {len(raw_data.get('stocks', []))}개 종목 반환"
            )
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

            price = s.get("price")
            prev_close = s.get("prevClose")
            change_rate = None
            if price is not None and prev_close and prev_close > 0:
                change_rate = round(((price - prev_close) / prev_close) * 100, 2)

            item = TossStockItem(
                ticker=ticker,
                stock_code=s.get("stockCode") or "",
                name=s.get("name") or ticker,
                price=price,
                prev_close=prev_close,
                change_rate=change_rate,
                market_cap=s.get("시가총액"),
                debt_ratio=s.get("부채_비율"),
                interest_coverage=s.get("이자_보상_배율"),
                operating_margin=s.get("영업_이익률"),
                roe=s.get("ROE"),
                logo_image_url=s.get("logoImageUrl"),
                screeners=["공통"],
            )
            items.append(item)

        self._cache_logo_items(items)

        return ScreenResult(
            tickers=items,
            items=items,
            total_count=raw_data.get("totalCount", len(items)),
            count=len(items),
            criteria=crit,
            source="toss_wts_direct",
        )

    def _enrich_item_fields(self, item: TossStockItem, s: dict) -> None:
        """중복 종목 발견 시 누락 필드 보강"""
        if item.price is None and s.get("price") is not None:
            item.price = s.get("price")
        if item.prev_close is None and s.get("prevClose") is not None:
            item.prev_close = s.get("prevClose")
        if item.market_cap is None and s.get("시가총액") is not None:
            item.market_cap = s.get("시가총액")
        if item.operating_margin is None and (s.get("영업_이익률") or s.get("영업이익률")) is not None:
            item.operating_margin = s.get("영업_이익률") or s.get("영업이익률")
        if item.roe is None and s.get("ROE") is not None:
            item.roe = s.get("ROE")
        if item.debt_ratio is None and (s.get("부채_비율") or s.get("부채비율")) is not None:
            item.debt_ratio = s.get("부채_비율") or s.get("부채비율")
        if item.interest_coverage is None and (s.get("이자_보상_배율") or s.get("이자보상배율")) is not None:
            item.interest_coverage = s.get("이자_보상_배율") or s.get("이자보상배율")
        if item.logo_image_url is None and s.get("logoImageUrl"):
            item.logo_image_url = s.get("logoImageUrl")
        if (
            item.change_rate is None
            and item.price is not None
            and item.prev_close
            and item.prev_close > 0
        ):
            item.change_rate = round(
                ((item.price - item.prev_close) / item.prev_close) * 100, 2
            )

    def _cache_logo_items(self, items: list[TossStockItem]) -> None:
        for item in items:
            if not item.ticker or not item.logo_image_url:
                continue
            self.logo_service.save_logo(
                ticker=item.ticker,
                logo_image_url=item.logo_image_url,
                stock_code=item.stock_code,
                source="toss_screener",
            )
