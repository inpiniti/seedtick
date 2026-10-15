"""
DataRoma(두번째 스크리너) 도메인 단위 테스트
"""
import pytest
from unittest.mock import AsyncMock

from app.domains.screener.clients.dataroma import (
    DataromaClient,
    parse_grand_portfolio,
)
from app.domains.screener.models import ScreenResult
from app.domains.screener.roma_service import RomaScreenerService


SAMPLE_HTML = """
<html><body><div id="main">
<table id="grid">
<caption><a href="https://intrinio.com">Quote data provided by Intrinio</a></caption>
<thead><tr>
<td class="sym">Symbol</td>
<td class="stock">Stock</td>
<td class="pct">%</td>
<td class="cnt">Ownership<br/>count</td>
<td class="hld">Hold Price*</td>
<td class="max">Max %</td>
<td>Current<br/>Price</td>
<td>52 Week<br/>Low</td>
<td>% Above<br/>52 Week<br/>Low</td>
<td>52 Week<br/>High</td>
</tr></thead>
<tbody><tr>
<td class="sym"><a href="/m/stock.php?sym=MSFT">MSFT</a></td>
<td class="stock"><a href="/m/stock.php?sym=MSFT">Microsoft Corp.</a></td>
<td>1.779</td>
<td>37</td>
<td class="hld">$373.02</td>
<td class="hld">20.54</td>
<td >$525.18</td>
<td >$348.54</td>
<td >50.68</td>
<td >$549.20</td>
</tr><tr>
<td class="sym"><a href="/m/stock.php?sym=RARE9">RARE9</a></td>
<td class="stock"><a href="/m/stock.php?sym=RARE9">Rare Nine Inc.</a></td>
<td>0.100</td>
<td>9</td>
<td class="hld">$10.00</td>
<td class="hld">0.10</td>
<td >$11.00</td>
<td >$8.00</td>
<td >37.50</td>
<td >$12.00</td>
</tr><tr>
<td class="sym"><a href="/m/stock.php?sym=BRK.A">BRK.A</a></td>
<td class="stock"><a href="/m/stock.php?sym=BRK.A">Berkshire Hathaway CL A</a></td>
<td>1.758</td>
<td>17</td>
<td class="hld">$748,851.77</td>
<td class="hld">42.42</td>
<td >$756,376.00</td>
<td >$698,000.00</td>
<td >8.36</td>
<td >$806,102.81</td>
</tr><tr>
<td class="sym"><a href="/m/stock.php?sym=TEN">TEN</a></td>
<td class="stock"><a href="/m/stock.php?sym=TEN">Ten Holdings Inc.</a></td>
<td>0.200</td>
<td>10</td>
<td class="hld">$20.00</td>
<td class="hld">1.00</td>
<td >$21.00</td>
<td >$15.00</td>
<td >40.00</td>
<td >$25.00</td>
</tr><tr>
<td class="sym"><a href="/m/stock.php?sym=MSFT">MSFT</a></td>
<td class="stock"><a href="/m/stock.php?sym=MSFT">Microsoft Corp. (중복행)</a></td>
<td>1.779</td>
<td>37</td>
<td class="hld">$373.02</td>
<td class="hld">20.54</td>
<td >$525.18</td>
<td >$348.54</td>
<td >50.68</td>
<td >$549.20</td>
</tr></tbody>
</table>
</div></body></html>
"""


def test_parse_grand_portfolio_filters_min_holders_and_dedupes():
    """보유자 10명 이상만 통과(9명 제외), 티커 중복 제거, 통화/쉼표 숫자 파싱 검증"""
    rows = parse_grand_portfolio(SAMPLE_HTML, min_holders=10)

    tickers = [r["ticker"] for r in rows]
    assert tickers == ["MSFT", "BRK.A", "TEN"]  # 9명 RARE9 제외, 중복 MSFT 제거
    assert len(tickers) == len(set(tickers))

    msft = rows[0]
    assert msft["name"] == "Microsoft Corp."
    assert msft["holders"] == 37
    assert msft["weight_pct"] == pytest.approx(1.779)
    assert msft["price"] == pytest.approx(525.18)
    assert msft["week52_low"] == pytest.approx(348.54)
    assert msft["week52_high"] == pytest.approx(549.20)
    assert msft["hold_price"] == pytest.approx(373.02)

    brk = rows[1]
    assert brk["price"] == pytest.approx(756376.00)  # '$756,376.00' 쉼표 제거
    assert brk["holders"] == 17

    # 경계값: 정확히 10명인 종목은 포함
    assert rows[2]["ticker"] == "TEN"
    assert rows[2]["holders"] == 10


@pytest.mark.asyncio
async def test_dataroma_client_fetch_grand_portfolio(monkeypatch):
    """클라이언트가 HTTP 응답 HTML을 파서에 전달하고 필터링하는지 검증"""
    captured: dict = {}

    class DummyResponse:
        status_code = 200
        text = SAMPLE_HTML

        def raise_for_status(self):
            return None

    class DummyClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url: str):
            captured["url"] = url
            return DummyResponse()

    monkeypatch.setattr("httpx.AsyncClient", DummyClient)

    client = DataromaClient()
    rows = await client.fetch_grand_portfolio(min_holders=10)

    assert captured["url"].startswith("https://www.dataroma.com/m/g/portfolio.php")
    assert [r["ticker"] for r in rows] == ["MSFT", "BRK.A", "TEN"]


@pytest.mark.asyncio
async def test_roma_service_returns_screen_result():
    """RomaScreenerService가 스크리너와 동일한 ScreenResult 형태로 반환하는지 검증"""
    mock_client = AsyncMock()
    mock_client.fetch_grand_portfolio.return_value = [
        {
            "ticker": "MSFT",
            "name": "Microsoft Corp.",
            "weight_pct": 1.779,
            "holders": 37,
            "hold_price": 373.02,
            "max_pct": 20.54,
            "price": 525.18,
            "week52_low": 348.54,
            "pct_above_52w_low": 50.68,
            "week52_high": 549.20,
        },
        {
            "ticker": "BRK.A",
            "name": "Berkshire Hathaway CL A",
            "weight_pct": 1.758,
            "holders": 17,
            "hold_price": 748851.77,
            "max_pct": 42.42,
            "price": 756376.00,
            "week52_low": 698000.00,
            "pct_above_52w_low": 8.36,
            "week52_high": 806102.81,
        },
    ]

    service = RomaScreenerService(client=mock_client)
    result: ScreenResult = await service.get_stock_list(min_holders=10)

    assert result.count == 2
    assert result.total_count == 2
    assert result.source == "dataroma_grand_portfolio"
    assert result.criteria.preset == "roma"
    assert [i.ticker for i in result.tickers] == ["MSFT", "BRK.A"]
    assert all(i.screeners == ["roma"] for i in result.tickers)
    assert result.tickers[0].holders == 37
    assert result.tickers[0].price == pytest.approx(525.18)
    assert result.tickers[1].week52_high == pytest.approx(806102.81)

    # size 상한 적용
    limited = await service.get_stock_list(min_holders=10, size=1)
    assert limited.count == 1
    assert limited.tickers[0].ticker == "MSFT"


@pytest.mark.asyncio
async def test_roma_service_raises_on_empty_result():
    """조회 결과가 비어 있으면 RuntimeError (기존 스크리너와 동일 계약)"""
    mock_client = AsyncMock()
    mock_client.fetch_grand_portfolio.return_value = []

    service = RomaScreenerService(client=mock_client)
    with pytest.raises(RuntimeError):
        await service.get_stock_list(min_holders=10)


def test_parse_grand_portfolio_raises_without_table():
    """보유 표가 없는 HTML이 들어오면 RuntimeError"""
    with pytest.raises(RuntimeError):
        parse_grand_portfolio("<html><body><p>no table</p></body></html>")
