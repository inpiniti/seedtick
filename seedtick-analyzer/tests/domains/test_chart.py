"""
테스트: ChartService 일봉 데이터 파싱 및 볼린저 밴드(20, 2) 계산 검증
"""
import pytest
from httpx import ASGITransport, AsyncClient
from app.domains.screener.chart_service import ChartService, normalize_yahoo_ticker
from app.domains.screener.models import StockChartResponse
from app.main import app


def test_normalize_yahoo_ticker_handles_share_classes():
    assert normalize_yahoo_ticker("BRK.A") == "BRK-A"
    assert normalize_yahoo_ticker("BRK.B") == "BRK-B"
    assert normalize_yahoo_ticker("AAPL") == "AAPL"


def test_calculate_bollinger_bands_logic():
    service = ChartService()
    # 25일치 인위적인 종가 데이터
    # 100부터 124까지 순차 증가
    closes = [100.0 + i for i in range(25)]
    dates = [f"2026-01-{i+1:02d}" for i in range(25)]
    
    bollinger_points = service.calculate_bollinger(dates, closes, period=20, k=2.0)
    
    assert len(bollinger_points) == 25
    # 첫 19개는 20일 데이터가 부족하므로 upper/middle/lower가 None
    for i in range(19):
        assert bollinger_points[i].middle is None
        assert bollinger_points[i].upper is None
        assert bollinger_points[i].lower is None
    
    # 20번째 (index 19)부터 계산되어야 함
    # 0~19: 값 100~119, 평균 = (100+119)/2 = 109.5
    p20 = bollinger_points[19]
    assert p20.middle is not None
    assert round(p20.middle, 2) == 109.5
    assert p20.upper > p20.middle
    assert p20.lower < p20.middle
    assert p20.percent_b is not None


def test_determine_bollinger_status():
    service = ChartService()
    
    # 1. 상단 돌파 (close > upper, percent_b > 1.0)
    s1 = service.determine_status(close=125.0, upper=120.0, middle=110.0, lower=100.0)
    assert s1.status == "UPPER_BREAK"
    assert "돌파" in s1.status_label
    
    # 2. 상단 근접 (percent_b >= 0.8)
    s2 = service.determine_status(close=118.0, upper=120.0, middle=110.0, lower=100.0)
    assert s2.status == "UPPER_NEAR"
    assert "상단" in s2.status_label
    
    # 3. 중심선 영역 (0.2 < percent_b < 0.8)
    s3 = service.determine_status(close=110.0, upper=120.0, middle=110.0, lower=100.0)
    assert s3.status == "MIDDLE"
    assert "중심선" in s3.status_label
    
    # 4. 하단 근접 (0.0 <= percent_b <= 0.2)
    s4 = service.determine_status(close=102.0, upper=120.0, middle=110.0, lower=100.0)
    assert s4.status == "LOWER_NEAR"
    assert "하단" in s4.status_label
    
    # 5. 하단 이탈 (close < lower, percent_b < 0.0)
    s5 = service.determine_status(close=95.0, upper=120.0, middle=110.0, lower=100.0)
    assert s5.status == "LOWER_BREAK"
    assert "이탈" in s5.status_label


@pytest.mark.asyncio
async def test_get_stock_chart_mocked(monkeypatch):
    service = ChartService()
    
    fake_yahoo_resp = {
        "chart": {
            "result": [
                {
                    "meta": {"currency": "USD", "symbol": "AAPL", "regularMarketPrice": 150.0},
                    "timestamp": [1704067200 + i * 86400 for i in range(30)],
                    "indicators": {
                        "quote": [
                            {
                                "open": [140.0 + i for i in range(30)],
                                "high": [145.0 + i for i in range(30)],
                                "low": [138.0 + i for i in range(30)],
                                "close": [142.0 + i for i in range(30)],
                                "volume": [1000000 + i * 1000 for i in range(30)],
                            }
                        ]
                    },
                }
            ],
            "error": None,
        }
    }
    
    async def fake_fetch(ticker: str, range_period: str = "6mo", interval: str = "1d"):
        return fake_yahoo_resp
        
    monkeypatch.setattr(service, "fetch_raw_yahoo_chart", fake_fetch)
    
    chart_res = await service.get_stock_chart("AAPL")
    assert isinstance(chart_res, StockChartResponse)
    assert chart_res.ticker == "AAPL"
    assert len(chart_res.candles) == 30
    assert len(chart_res.bollinger) == 30
    assert chart_res.summary is not None
    assert chart_res.summary.current_price == 142.0 + 29


@pytest.mark.asyncio
async def test_chart_api_route(monkeypatch):
    fake_yahoo_resp = {
        "chart": {
            "result": [
                {
                    "meta": {"symbol": "NVDA"},
                    "timestamp": [1704067200 + i * 86400 for i in range(25)],
                    "indicators": {
                        "quote": [
                            {
                                "open": [100.0 + i for i in range(25)],
                                "high": [105.0 + i for i in range(25)],
                                "low": [98.0 + i for i in range(25)],
                                "close": [102.0 + i for i in range(25)],
                                "volume": [500000 for _ in range(25)],
                            }
                        ]
                    },
                }
            ]
        }
    }

    async def fake_fetch(self, ticker: str, range_period: str = "6mo", interval: str = "1d"):
        return fake_yahoo_resp

    monkeypatch.setattr(ChartService, "fetch_raw_yahoo_chart", fake_fetch)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/screener/chart/NVDA")
        assert res.status_code == 200
        data = res.json()
        assert data["ticker"] == "NVDA"
        assert len(data["candles"]) == 25
        assert len(data["bollinger"]) == 25
        assert data["summary"] is not None
        assert "status" in data["summary"]


@pytest.mark.asyncio
async def test_chart_resolves_toss_stock_code(monkeypatch):
    service = ChartService()
    called_tickers = []

    async def fake_fetch(ticker: str, range_period: str = "6mo", interval: str = "1d"):
        called_tickers.append(ticker)
        return {
            "chart": {
                "result": [
                    {
                        "meta": {"symbol": ticker},
                        "timestamp": [1704067200],
                        "indicators": {
                            "quote": [{"open": [100.0], "high": [105.0], "low": [98.0], "close": [102.0], "volume": [1000]}]
                        },
                    }
                ]
            }
        }

    monkeypatch.setattr(service, "fetch_raw_yahoo_chart", fake_fetch)
    # US19890516001 should resolve to MU
    chart = await service.get_stock_chart("US19890516001")
    assert chart.ticker == "MU"
    assert "MU" in called_tickers


@pytest.mark.asyncio
async def test_chart_api_returns_404_when_ticker_not_found(monkeypatch):
    import httpx

    async def fake_fetch(self, ticker: str, range_period: str = "6mo", interval: str = "1d"):
        request = httpx.Request("GET", "https://query1.finance.yahoo.com")
        response = httpx.Response(status_code=404, request=request)
        raise httpx.HTTPStatusError("404 Not Found", request=request, response=response)

    monkeypatch.setattr(ChartService, "fetch_raw_yahoo_chart", fake_fetch)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/screener/chart/NONEXISTENT123")
        assert res.status_code == 404
        assert "찾을 수 없습니다" in res.json()["detail"]

