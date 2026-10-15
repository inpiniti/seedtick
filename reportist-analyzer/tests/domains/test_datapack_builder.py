"""
DataPackBuilder 단위 테스트
"""
import pytest
from pathlib import Path
from app.domains.report.datapack_builder import DataPackBuilder


def test_datapack_render_markdown(tmp_path: Path):
    builder = DataPackBuilder(base_report_dir=tmp_path)

    # 모의 데이터로 assemble_datapack 테스트
    mock_chart = {
        "chart": {
            "result": [
                {
                    "meta": {
                        "regularMarketPrice": 225.50,
                        "fiftyTwoWeekHigh": 235.0,
                        "fiftyTwoWeekLow": 165.0,
                    }
                }
            ]
        }
    }
    mock_ts = {
        "timeseries": {
            "result": [
                {
                    "annualTotalRevenue": [
                        {"asOfDate": "2024-12-31", "reportedValue": {"raw": 390000000000}},
                        {"asOfDate": "2025-12-31", "reportedValue": {"raw": 410000000000}},
                    ]
                },
                {
                    "annualNetIncome": [
                        {"asOfDate": "2024-12-31", "reportedValue": {"raw": 95000000000}},
                        {"asOfDate": "2025-12-31", "reportedValue": {"raw": 105000000000}},
                    ]
                },
            ]
        }
    }
    mock_quote = {
        "quoteSummary": {
            "result": [
                {
                    "summaryDetail": {
                        "marketCap": {"raw": 3400000000000},
                        "trailingPE": {"raw": 32.5},
                        "forwardPE": {"raw": 28.0},
                    },
                    "defaultKeyStatistics": {
                        "pegRatio": {"raw": 1.2},
                    },
                    "financialData": {
                        "returnOnEquity": {"raw": 1.25},
                    },
                    "assetProfile": {
                        "sector": "Technology",
                        "industry": "Consumer Electronics",
                        "longBusinessSummary": "Apple designs consumer electronics.",
                    },
                }
            ]
        }
    }

    dp = builder._assemble_datapack("AAPL", "2026-09-23", mock_chart, mock_ts, mock_quote)
    assert dp.ticker == "AAPL"
    assert dp.current_price == 225.50
    assert dp.valuation.trailing_pe == 32.5

    md = builder._render_markdown(dp)
    assert "# AAPL — 공용 심층 데이터 팩" in md
    assert "Technology / Consumer Electronics" in md
    assert "$225.50" in md


@pytest.mark.asyncio
async def test_fetch_quote_summary_401_retry(monkeypatch, tmp_path: Path):
    """401 에러 수신 시 crumb 캐시를 초기화하고 force_refresh로 재시도하여 성공하는지 검증"""
    builder = DataPackBuilder(base_report_dir=tmp_path)

    # 1번째 호출은 401, 2번째 호출은 200 정상 반환
    call_counts = {"auth": 0, "quote": 0}

    async def mock_get_auth(client, force_refresh=False):
        call_counts["auth"] += 1
        if force_refresh:
            return "fresh_cookie=1", "fresh_crumb"
        return "stale_cookie=1", "stale_crumb"

    builder._get_auth = mock_get_auth

    class MockResponse:
        def __init__(self, status_code, data=None):
            self.status_code = status_code
            self._data = data or {}
            self.text = "Unauthorized" if status_code == 401 else "ok"

        def json(self):
            return self._data

    class MockClient:
        async def get(self, url, headers=None, **kwargs):
            if "ai-gateway" in url:
                return MockResponse(500)
            call_counts["quote"] += 1
            if "stale_crumb" in url:
                return MockResponse(401)
            return MockResponse(200, {"quoteSummary": {"result": [{"summaryDetail": {"ok": 1}, "assetProfile": {"ok": 1}}]}})

    res = await builder._fetch_quote_summary(MockClient(), "SKHY")
    assert call_counts["auth"] == 2
    assert call_counts["quote"] == 2
    assert res == {"quoteSummary": {"result": [{"summaryDetail": {"ok": 1}, "assetProfile": {"ok": 1}}]}}


def test_datapack_quarterly_income_parsing_and_render(tmp_path: Path):
    """분기(Quarterly) 손익/현금흐름 파싱 및 마크다운 렌더링 검증"""
    builder = DataPackBuilder(base_report_dir=tmp_path)
    mock_chart = {"chart": {"result": [{"meta": {"regularMarketPrice": 150.0}}]}}
    mock_quote = {"quoteSummary": {"result": [{"financialData": {}, "assetProfile": {}}]}}
    mock_ts = {
        "timeseries": {
            "result": [
                {
                    "annualTotalRevenue": [
                        {"asOfDate": "2025-12-31", "reportedValue": {"raw": 100000000000}},
                    ]
                },
                {
                    "quarterlyTotalRevenue": [
                        {"asOfDate": "2026-03-31", "reportedValue": {"raw": 25000000000}},
                        {"asOfDate": "2026-06-30", "reportedValue": {"raw": 28000000000}},
                    ]
                },
                {
                    "quarterlyOperatingIncome": [
                        {"asOfDate": "2026-03-31", "reportedValue": {"raw": 7500000000}},
                        {"asOfDate": "2026-06-30", "reportedValue": {"raw": 8960000000}},
                    ]
                },
                {
                    "quarterlyDilutedEPS": [
                        {"asOfDate": "2026-03-31", "reportedValue": {"raw": 1.50}},
                        {"asOfDate": "2026-06-30", "reportedValue": {"raw": 1.80}},
                    ]
                },
            ]
        }
    }

    dp = builder._assemble_datapack("NVDA", "2026-10-13", mock_chart, mock_ts, mock_quote)
    assert len(dp.income_annual) == 1
    assert len(dp.income_quarterly) == 2

    # 분기 라벨 검증
    assert dp.income_quarterly[0].year == "2026-Q1"
    assert dp.income_quarterly[1].year == "2026-Q2"
    assert dp.income_quarterly[1].eps == 1.80
    assert dp.income_quarterly[1].operating_margin_pct == pytest.approx(32.0, rel=1e-2)

    # 마크다운 렌더링 검증
    md = builder._render_markdown(dp)
    assert "### 최근 분기 실적 추이 (최근 5개 분기)" in md
    assert "2026-Q1" in md
    assert "2026-Q2" in md
    assert "32.0%" in md


