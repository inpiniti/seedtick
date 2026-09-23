"""
Screener 도메인 단위 테스트
"""
import pytest
from unittest.mock import AsyncMock
from app.domains.screener.models import ScreenCriteria
from app.domains.screener.service import ScreenerService


@pytest.mark.asyncio
async def test_screener_service_direct_call():
    mock_wts_client = AsyncMock()
    mock_wts_client.screen_common_us.return_value = {
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
