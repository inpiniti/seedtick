"""
Screener 도메인 단위 테스트
"""
import pytest
from unittest.mock import AsyncMock
from app.domains.screener.models import ScreenCriteria
from app.domains.screener.service import ScreenerService


@pytest.mark.asyncio
async def test_screener_service_direct_call():
    """WTS 직접 호출 테스트 (하위 호환성)"""
    mock_wts_client = AsyncMock()
    mock_data = {
        "count": 2,
        "totalCount": 150,
        "stocks": [
            {
                "ticker": "AAPL",
                "stockCode": "US0378331005",
                "name": "애플",
                "price": 220.5,
                "prevClose": 218.0,
                "시가총액": 3400000000000,
                "부채_비율": 0.8,
                "이자_보상_배율": 15.0,
                "영업_이익률": 0.3,
                "ROE": 0.45,
            },
            {
                "ticker": "NVDA",
                "stockCode": "US67066G1040",
                "name": "엔비디아",
                "price": 125.0,
                "prevClose": 120.0,
                "시가총액": 3000000000000,
                "부채_비율": 0.4,
                "이자_보상_배율": 25.0,
                "영업_이익률": 0.6,
                "ROE": 0.70,
            },
        ],
    }
    mock_wts_client.screen_common.return_value = mock_data
    mock_wts_client.screen_common_us.return_value = mock_data

    service = ScreenerService(wts_client=mock_wts_client)
    criteria = ScreenCriteria(preset="공통", nation="us", size=50)
    result = await service.get_stock_list(criteria)

    assert result.count == 2
    assert result.total_count == 150
    assert result.tickers[0].ticker == "AAPL"
    assert result.tickers[0].name == "애플"
    assert result.tickers[0].price == 220.5
    assert result.tickers[1].ticker == "NVDA"
    assert result.source == "toss_wts_direct"


@pytest.mark.asyncio
async def test_screener_service_combined_12_gurus_and_deduplication():
    """
    종합 + 12인 거장 통합 스크리너 테스트:
    - 중복 티커는 새로 추가하지 않고 버려지며(deduplicate), 매칭된 screeners 라벨만 추가
    - 종합(공통) 종목 우선 배치
    """
    mock_btc_client = AsyncMock()

    # 가상 거장별 반환 데이터
    # 공통: AAPL, NVDA
    # 슈웨거: NVDA (중복), MSFT (신규)
    # 버핏: AAPL (중복), AMZN (신규)
    # 린치: WDC (신규)
    async def mock_get_all_gurus_screeners(gurus, nation, size, page):
        res = []
        for g in gurus:
            if g == "공통":
                res.append((g, {
                    "stocks": [
                        {"ticker": "AAPL", "stockCode": "US0378331005", "name": "애플", "price": 220.0, "prevClose": 218.0},
                        {"ticker": "NVDA", "stockCode": "US67066G1040", "name": "엔비디아", "price": 125.0, "prevClose": 120.0},
                    ]
                }))
            elif g == "슈웨거":
                res.append((g, {
                    "stocks": [
                        {"ticker": "NVDA", "stockCode": "US67066G1040", "name": "엔비디아", "price": 125.0, "prevClose": 120.0},
                        {"ticker": "MSFT", "stockCode": "US19860313001", "name": "마이크로소프트", "price": 400.0, "prevClose": 395.0},
                    ]
                }))
            elif g == "버핏":
                res.append((g, {
                    "stocks": [
                        {"ticker": "AAPL", "stockCode": "US0378331005", "name": "애플", "price": 220.0, "prevClose": 218.0},
                        {"ticker": "AMZN", "stockCode": "US0231351067", "name": "아마존", "price": 180.0, "prevClose": 178.0},
                    ]
                }))
            elif g == "린치":
                res.append((g, {
                    "stocks": [
                        {"ticker": "WDC", "stockCode": "US9581021055", "name": "웨스턴디지털", "price": 70.0, "prevClose": 69.0},
                    ]
                }))
            else:
                res.append((g, {"stocks": []}))
        return res

    mock_btc_client.get_all_gurus_screeners.side_effect = mock_get_all_gurus_screeners

    service = ScreenerService(btc_client=mock_btc_client)
    criteria = ScreenCriteria(preset="공통", nation="us", size=100)
    result = await service.get_stock_list(criteria)

    assert result.source == "btc_ai_screener_combined"
    assert result.count == 5  # AAPL, NVDA, MSFT, AMZN, WDC (중복 제거됨)
    assert result.total_count == 5

    tickers = [t.ticker for t in result.tickers]
    assert tickers == ["AAPL", "NVDA", "MSFT", "AMZN", "WDC"]

    # screeners 라벨 확인
    item_map = {t.ticker: t for t in result.tickers}
    assert item_map["AAPL"].screeners == ["종합", "버핏"]
    assert item_map["NVDA"].screeners == ["종합", "슈웨거"]
    assert item_map["MSFT"].screeners == ["슈웨거"]
    assert item_map["AMZN"].screeners == ["버핏"]
    assert item_map["WDC"].screeners == ["린치"]

    # change_rate 계산 확인
    assert item_map["AAPL"].change_rate == round(((220.0 - 218.0) / 218.0) * 100, 2)


@pytest.mark.asyncio
async def test_screener_service_excludes_philip_fisher():
    """필립 피셔(과다 조회) 제외 테스트"""
    mock_btc_client = AsyncMock()
    service = ScreenerService(btc_client=mock_btc_client)

    criteria1 = ScreenCriteria(preset="피셔")
    res1 = await service.get_stock_list(criteria1)
    assert res1.count == 0
    assert res1.source == "screener_excluded"

    criteria2 = ScreenCriteria(preset="필립 피셔")
    res2 = await service.get_stock_list(criteria2)
    assert res2.count == 0
    assert res2.source == "screener_excluded"


@pytest.mark.asyncio
async def test_screener_service_btc_failure_fallback_to_wts():
    """BTC-AI 실패 시 Toss WTS 폴백 테스트"""
    mock_btc_client = AsyncMock()
    mock_btc_client.get_all_gurus_screeners.side_effect = RuntimeError("BTC-AI 네트워크 에러")

    mock_wts_client = AsyncMock()
    mock_wts_client.screen_common.return_value = {
        "count": 1,
        "totalCount": 1,
        "stocks": [{"ticker": "TSLA", "stockCode": "US88160R1014", "name": "테슬라"}],
    }

    service = ScreenerService(btc_client=mock_btc_client, wts_client=mock_wts_client)
    res = await service.get_stock_list(ScreenCriteria(preset="공통"))

    assert res.source == "toss_wts_direct"
    assert res.count == 1
    assert res.tickers[0].ticker == "TSLA"
