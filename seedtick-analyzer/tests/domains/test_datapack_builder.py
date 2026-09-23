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
