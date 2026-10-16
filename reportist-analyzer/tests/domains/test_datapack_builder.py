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


@pytest.mark.asyncio
async def test_resolve_symbol_naver_and_equity_check(tmp_path: Path):
    """국장 6자리 종목의 코스피/코스닥 판별: 네이버 거래소 정보 및 Yahoo instrumentType 검증"""
    builder = DataPackBuilder(base_report_dir=tmp_path)

    class MockClient:
        def __init__(self):
            self.calls = []

        async def get(self, url, headers=None, **kwargs):
            self.calls.append(url)
            # 네이버 모바일 API
            if "m.stock.naver.com" in url:
                if "327260" in url:
                    return type("Res", (), {"status_code": 200, "json": lambda self=None: {"stockExchangeType": {"code": "KQ"}}})()
                if "005930" in url:
                    return type("Res", (), {"status_code": 200, "json": lambda self=None: {"stockExchangeType": {"code": "KS"}}})()
                return type("Res", (), {"status_code": 404, "json": lambda self=None: {}})()

            # Yahoo chart 폴백
            if "999999.KS" in url:
                # 펀드 상품 등으로 잘못 매핑된 경우
                return type("Res", (), {
                    "status_code": 200,
                    "json": lambda self=None: {"chart": {"result": [{"meta": {"instrumentType": "MUTUALFUND"}}]}}
                })()
            if "999999.KQ" in url:
                return type("Res", (), {
                    "status_code": 200,
                    "json": lambda self=None: {"chart": {"result": [{"meta": {"instrumentType": "EQUITY"}}]}}
                })()
            return type("Res", (), {"status_code": 404, "json": lambda self=None: {}})()

    client = MockClient()

    # 1. 네이버 KQ -> .KQ
    sym_kq = await builder._resolve_symbol(client, "327260")
    assert sym_kq == "327260.KQ"

    # 2. 네이버 KS -> .KS
    sym_ks = await builder._resolve_symbol(client, "005930")
    assert sym_ks == "005930.KS"

    # 3. 네이버 실패 후 Yahoo chart 검증 (.KS가 MUTUALFUND이면 .KQ 선택)
    sym_fallback = await builder._resolve_symbol(client, "999999")
    assert sym_fallback == "999999.KQ"


@pytest.mark.asyncio
async def test_auth_circuit_breaker(tmp_path: Path):
    """Yahoo Auth 연속 실패 후 서킷 브레이커(쿨다운) 동작 검증"""
    builder = DataPackBuilder(base_report_dir=tmp_path)
    # 직전 실패 시간을 현재 시점으로 설정
    import time
    builder._last_auth_failure_time = time.time()
    builder._auth_failure_cooldown = 900.0  # 15분

    call_count = 0
    class MockClient:
        async def get(self, url, headers=None, **kwargs):
            nonlocal call_count
            call_count += 1
            return type("Res", (), {"status_code": 429, "text": "Too Many Requests", "cookies": {}})()

    # 쿨다운 중이므로 네트워크 요청 없이 즉시 예외 발생해야 함
    with pytest.raises(RuntimeError, match="쿨다운"):
        await builder._get_auth(MockClient())

    assert call_count == 0


def test_assemble_datapack_with_naver_fallback(tmp_path: Path):
    """Yahoo quoteSummary에서 누락된 필드가 네이버 데이터로 채워지는지 검증"""
    builder = DataPackBuilder(base_report_dir=tmp_path)

    mock_chart = {"chart": {"result": [{"meta": {"regularMarketPrice": 40950.0}}]}}
    mock_ts = {"timeseries": {"result": []}}
    # Yahoo에서 PE, Target, Sector 모두 None인 빈 응답
    mock_quote = {"quoteSummary": {"result": [{"summaryDetail": {}, "financialData": {}, "assetProfile": {}}]}}

    naver_data = {
        "stockName": "RF머트리얼즈",
        "stockExchangeType": {"code": "KQ", "nameKor": "코스닥"},
        "totalInfos": [
            {"code": "per", "key": "PER", "value": "60.98배"},
            {"code": "cnsPer", "key": "추정PER", "value": "58.05배"},
            {"code": "pbr", "key": "PBR", "value": "8.79배"},
            {"code": "marketValue", "key": "시총", "value": "7,591억"},
            {"code": "foreignRate", "key": "외인소진율", "value": "8.57%"},
            {"code": "highPriceOf52WeeksAdjusted", "key": "52주 최고", "value": "63,420"},
            {"code": "lowPriceOf52WeeksAdjusted", "key": "52주 최저", "value": "7,526"},
        ],
        "consensusInfo": {
            "recommMean": "4.00",
            "priceTargetMean": "72,667",
        },
        "dealTrendInfos": [
            {"bizdate": "20261015", "foreignerPureBuyQuant": "+174,046", "organPureBuyQuant": "-50,579", "closePrice": "38,850"}
        ],
        "researches": [
            {"tit": "루멘텀 솔벤더의 위엄", "bnm": "신한투자증권", "wdt": "20260910"}
        ]
    }

    dp = builder._assemble_datapack(
        ticker="327260",
        date_str="2026-10-16",
        chart=mock_chart,
        ts=mock_ts,
        quote=mock_quote,
        naver_data=naver_data,
    )

    # 네이버 데이터로 보완된 지표 확인
    assert dp.company_name == "RF머트리얼즈"
    assert dp.valuation.trailing_pe == 60.98
    assert dp.valuation.forward_pe == 58.05
    assert dp.valuation.pbr == 8.79
    assert dp.valuation.market_cap == 759_100_000_000.0
    assert dp.analyst_consensus["목표주가 평균"] == "72,667원"
    assert dp.analyst_consensus["투자의견"] == "4.00"
    assert dp.market_metrics["52주 고가"] == "63,420원"
    assert dp.market_metrics["52주 저가"] == "7,526원"
    assert dp.market_metrics["외국인 소진율"] == "8.57%"
    assert "루멘텀 솔벤더의 위엄" in str(dp.news_items) or "최신 증권사 리포트" in builder._render_markdown(dp)



