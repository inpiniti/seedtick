"""
DataPackBuilder: Yahoo Finance 및 무료 API를 활용한 결정론적 심층 데이터팩 생성기
"""
import asyncio
import logging
from datetime import date as dt_date
from datetime import datetime
from pathlib import Path
import httpx

from app.domains.report.models import (
    BalanceSheetRow,
    CashFlowRow,
    FinancialStatementRow,
    StockDataPack,
    ValuationRow,
)

logger = logging.getLogger("datapack_builder")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
Y1 = "https://query1.finance.yahoo.com"


class DataPackBuilder:
    def __init__(self, base_report_dir: str | Path = "docs/report"):
        self.base_report_dir = Path(base_report_dir)
        self._auth_lock = asyncio.Lock()
        self._cookie: str | None = None
        self._crumb: str | None = None

    async def _get_auth(self, client: httpx.AsyncClient) -> tuple[str, str]:
        async with self._auth_lock:
            if self._cookie and self._crumb:
                return self._cookie, self._crumb

            # 1. fc.yahoo.com에서 쿠키 획득
            res1 = await client.get("https://fc.yahoo.com", headers={"User-Agent": UA})
            cookies = [f"{k}={v}" for k, v in res1.cookies.items()]
            cookie_str = "; ".join(cookies)

            # 2. getcrumb 호출
            res2 = await client.get(
                f"{Y1}/v1/test/getcrumb",
                headers={"User-Agent": UA, "Cookie": cookie_str},
            )
            crumb = res2.text.strip()
            self._cookie = cookie_str
            self._crumb = crumb
            logger.info("[DataPackBuilder] Yahoo Crumb 발급 완료")
            return self._cookie, self._crumb

    async def build(self, ticker: str, target_date: str | None = None) -> StockDataPack:
        """
        티커의 심층 데이터팩을 수집하고 마크다운 파일로 저장:
        docs/report/{date}/_data/{ticker}.md
        """
        date_str = target_date or dt_date.today().isoformat()
        clean_ticker = ticker.upper().strip()

        async with httpx.AsyncClient(timeout=25.0) as client:
            # 1. 병렬 수집: Chart, Fundamentals Timeseries, QuoteSummary
            chart_task = self._fetch_chart(client, clean_ticker)
            ts_task = self._fetch_timeseries(client, clean_ticker)
            quote_task = self._fetch_quote_summary(client, clean_ticker)

            chart_data, ts_data, quote_data = await asyncio.gather(
                chart_task, ts_task, quote_task, return_exceptions=True
            )

        if isinstance(chart_data, Exception):
            logger.warning(f"[{clean_ticker}] Chart API 실패: {chart_data}")
            chart_data = {}
        if isinstance(ts_data, Exception):
            logger.warning(f"[{clean_ticker}] Timeseries API 실패: {ts_data}")
            ts_data = {}
        if isinstance(quote_data, Exception):
            logger.warning(f"[{clean_ticker}] QuoteSummary API 실패: {quote_data}")
            quote_data = {}

        # 2. 지표 가공 및 파싱
        datapack = self._assemble_datapack(clean_ticker, date_str, chart_data, ts_data, quote_data)

        # 3. 마크다운 렌더링 및 파일 저장
        markdown_text = self._render_markdown(datapack)
        datapack.raw_markdown = markdown_text

        out_dir = self.base_report_dir / date_str / "_data"
        out_dir.mkdir(parents=True, exist_ok=True)
        file_path = out_dir / f"{clean_ticker}.md"
        file_path.write_text(markdown_text, encoding="utf-8")
        datapack.file_path = str(file_path)

        logger.info(f"[{clean_ticker}] 심층 데이터팩 생성 완료: {file_path}")
        return datapack

    async def _fetch_chart(self, client: httpx.AsyncClient, ticker: str) -> dict:
        url = f"{Y1}/v8/finance/chart/{ticker}?range=1y&interval=1wk"
        res = await client.get(url, headers={"User-Agent": UA})
        res.raise_for_status()
        return res.json()

    async def _fetch_timeseries(self, client: httpx.AsyncClient, ticker: str) -> dict:
        types = [
            "annualTotalRevenue", "annualGrossProfit", "annualOperatingIncome",
            "annualNetIncome", "annualDilutedEPS", "annualOperatingCashFlow",
            "annualFreeCashFlow", "annualCapitalExpenditure", "annualTotalDebt",
            "annualStockholdersEquity", "annualCashAndCashEquivalents",
            "annualCurrentAssets", "annualCurrentLiabilities",
        ]
        now_ts = int(datetime.now().timestamp())
        url = (
            f"{Y1}/ws/fundamentals-timeseries/v1/finance/timeseries/{ticker}"
            f"?type={','.join(types)}&period1=1420070400&period2={now_ts}"
        )
        res = await client.get(url, headers={"User-Agent": UA})
        res.raise_for_status()
        return res.json()

    async def _fetch_quote_summary(self, client: httpx.AsyncClient, ticker: str) -> dict:
        try:
            cookie, crumb = await self._get_auth(client)
            modules = [
                "summaryDetail", "defaultKeyStatistics", "financialData",
                "assetProfile", "recommendationTrend",
            ]
            url = f"{Y1}/v10/finance/quoteSummary/{ticker}?modules={','.join(modules)}&crumb={crumb}"
            res = await client.get(url, headers={"User-Agent": UA, "Cookie": cookie})
            if res.status_code == 200:
                return res.json()
        except Exception as e:
            logger.warning(f"[{ticker}] QuoteSummary 요청 실패: {e}")
        return {}

    def _assemble_datapack(
        self, ticker: str, date_str: str, chart: dict, ts: dict, quote: dict
    ) -> StockDataPack:
        # Chart 메타 추출
        chart_res = (chart.get("chart", {}).get("result") or [{}])[0]
        meta = chart_res.get("meta", {})
        price = meta.get("regularMarketPrice") or 0.0
        high52 = meta.get("fiftyTwoWeekHigh")
        low52 = meta.get("fiftyTwoWeekLow")

        # QuoteSummary 모듈 추출
        qs_res = (quote.get("quoteSummary", {}).get("result") or [{}])[0]
        summary_detail = qs_res.get("summaryDetail", {})
        key_stats = qs_res.get("defaultKeyStatistics", {})
        fin_data = qs_res.get("financialData", {})
        profile = qs_res.get("assetProfile", {})

        company_name = profile.get("longBusinessSummary", "")
        sector = profile.get("sector", "N/A")
        industry = profile.get("industry", "N/A")
        short_summary = profile.get("longBusinessSummary", "")[:350]

        # 밸류에이션 지표
        market_cap = (
            self._raw(summary_detail.get("marketCap"))
            or self._raw(key_stats.get("enterpriseValue"))
            or 0.0
        )
        trailing_pe = self._raw(summary_detail.get("trailingPE"))
        forward_pe = self._raw(summary_detail.get("forwardPE"))
        peg = self._raw(key_stats.get("pegRatio"))
        pbr = self._raw(summary_detail.get("priceToBook"))
        psr = self._raw(summary_detail.get("priceToSalesTrailing12Months"))
        ev_ebitda = self._raw(key_stats.get("enterpriseToEbitda"))
        dividend_yield = self._raw(summary_detail.get("dividendYield"))

        valuation = ValuationRow(
            current_price=price,
            market_cap=market_cap,
            enterprise_value=self._raw(key_stats.get("enterpriseValue")),
            trailing_pe=trailing_pe,
            forward_pe=forward_pe,
            peg=peg,
            pbr=pbr,
            psr=psr,
            ev_ebitda=ev_ebitda,
            dividend_yield_pct=(dividend_yield * 100) if dividend_yield else None,
        )

        # Timeseries 파싱
        income_rows = self._parse_income_rows(ts)
        cashflow_rows = self._parse_cashflow_rows(ts)
        balance_sheet = self._parse_balance_sheet(ts, fin_data)

        overview = (
            f"- **섹터/산업**: {sector} / {industry}\n"
            f"- **사업 개요**: {short_summary}..."
        )

        market_metrics = {
            "52주 고가": f"${high52:.2f}" if high52 else "N/A",
            "52주 저가": f"${low52:.2f}" if low52 else "N/A",
            "공매도 비율(Short % of Float)": self._pct(self._raw(key_stats.get("shortPercentOfFloat"))),
            "내부자 지분율": self._pct(self._raw(key_stats.get("heldPercentInsiders"))),
            "기관 지분율": self._pct(self._raw(key_stats.get("heldPercentInstitutions"))),
            "50일 이동평균선": f"${self._raw(summary_detail.get('fiftyDayAverage')):.2f}" if self._raw(summary_detail.get("fiftyDayAverage")) else "N/A",
            "200일 이동평균선": f"${self._raw(summary_detail.get('twoHundredDayAverage')):.2f}" if self._raw(summary_detail.get("twoHundredDayAverage")) else "N/A",
        }

        analyst_consensus = {
            "목표주가 평균": f"${self._raw(fin_data.get('targetMeanPrice')):.2f}" if self._raw(fin_data.get("targetMeanPrice")) else "N/A",
            "목표주가 최고": f"${self._raw(fin_data.get('targetHighPrice')):.2f}" if self._raw(fin_data.get("targetHighPrice")) else "N/A",
            "목표주가 최저": f"${self._raw(fin_data.get('targetLowPrice')):.2f}" if self._raw(fin_data.get("targetLowPrice")) else "N/A",
            "투자의견": fin_data.get("recommendationKey", "N/A"),
        }

        return StockDataPack(
            ticker=ticker,
            company_name=ticker,
            date=date_str,
            current_price=price,
            overview=overview,
            income_annual=income_rows,
            cashflow_annual=cashflow_rows,
            balance_sheet=balance_sheet,
            valuation=valuation,
            market_metrics=market_metrics,
            analyst_consensus=analyst_consensus,
        )

    def _parse_income_rows(self, ts: dict) -> list[FinancialStatementRow]:
        rev_s = self._series(ts, "annualTotalRevenue")
        gp_s = self._series(ts, "annualGrossProfit")
        op_s = self._series(ts, "annualOperatingIncome")
        net_s = self._series(ts, "annualNetIncome")
        eps_s = self._series(ts, "annualDilutedEPS")

        dates = sorted(list({p["date"] for p in rev_s + op_s + net_s}))[-5:]
        rows = []
        for d in dates:
            r = self._val(rev_s, d)
            gp = self._val(gp_s, d)
            op = self._val(op_s, d)
            ni = self._val(net_s, d)
            ep = self._val(eps_s, d)

            gm = (gp / r * 100) if (gp and r) else None
            om = (op / r * 100) if (op and r) else None
            nm = (ni / r * 100) if (ni and r) else None

            rows.append(
                FinancialStatementRow(
                    year=d[:4],
                    revenue=r,
                    gross_profit=gp,
                    gross_margin_pct=gm,
                    operating_income=op,
                    operating_margin_pct=om,
                    net_income=ni,
                    net_margin_pct=nm,
                    eps=ep,
                )
            )
        return rows

    def _parse_cashflow_rows(self, ts: dict) -> list[CashFlowRow]:
        ocf_s = self._series(ts, "annualOperatingCashFlow")
        capex_s = self._series(ts, "annualCapitalExpenditure")
        fcf_s = self._series(ts, "annualFreeCashFlow")

        dates = sorted(list({p["date"] for p in ocf_s + fcf_s}))[-5:]
        rows = []
        for d in dates:
            ocf = self._val(ocf_s, d)
            capex = self._val(capex_s, d)
            fcf = self._val(fcf_s, d)
            rows.append(
                CashFlowRow(
                    year=d[:4],
                    operating_cash_flow=ocf,
                    capex=capex,
                    fcf=fcf,
                )
            )
        return rows

    def _parse_balance_sheet(self, ts: dict, fin_data: dict) -> BalanceSheetRow:
        cash = self._last(self._series(ts, "annualCashAndCashEquivalents")) or self._raw(fin_data.get("totalCash"))
        debt = self._last(self._series(ts, "annualTotalDebt")) or self._raw(fin_data.get("totalDebt"))
        equity = self._last(self._series(ts, "annualStockholdersEquity"))
        curr_assets = self._last(self._series(ts, "annualCurrentAssets"))
        curr_liab = self._last(self._series(ts, "annualCurrentLiabilities"))

        net_debt = (debt - cash) if (debt is not None and cash is not None) else None
        debt_ratio = (debt / equity) if (debt is not None and equity) else None
        curr_ratio = (curr_assets / curr_liab) if (curr_assets and curr_liab) else self._raw(fin_data.get("currentRatio"))
        roe = self._raw(fin_data.get("returnOnEquity"))
        roa = self._raw(fin_data.get("returnOnAssets"))

        return BalanceSheetRow(
            cash_and_investments=cash,
            total_debt=debt,
            net_debt=net_debt,
            stockholders_equity=equity,
            debt_ratio=debt_ratio,
            current_ratio=curr_ratio,
            roe_pct=(roe * 100) if roe else None,
            roa_pct=(roa * 100) if roa else None,
        )

    def _series(self, ts: dict, type_name: str) -> list[dict]:
        for r in ts.get("timeseries", {}).get("result", []):
            if type_name in r:
                return [
                    {"date": p["asOfDate"], "value": self._raw(p.get("reportedValue"))}
                    for p in r[type_name]
                    if p.get("reportedValue") is not None
                ]
        return []

    def _val(self, series: list[dict], date: str) -> float | None:
        for p in series:
            if p["date"] == date:
                return p["value"]
        return None

    def _last(self, series: list[dict]) -> float | None:
        return series[-1]["value"] if series else None

    def _raw(self, obj: dict | float | int | None) -> float | None:
        if isinstance(obj, dict):
            return obj.get("raw")
        if isinstance(obj, (int, float)):
            return float(obj)
        return None

    def _pct(self, v: float | None) -> str:
        return f"{v * 100:.2f}%" if v is not None else "N/A"

    def _money(self, v: float | None) -> str:
        if v is None:
            return "N/A"
        a = abs(v)
        if a >= 1e12:
            return f"${v / 1e12:.2f}T"
        if a >= 1e9:
            return f"${v / 1e9:.2f}B"
        if a >= 1e6:
            return f"${v / 1e6:.1f}M"
        return f"${v:,.0f}"

    def _render_markdown(self, dp: StockDataPack) -> str:
        lines = [
            f"# {dp.ticker} — 공용 심층 데이터 팩",
            f"> 조회 시점: {dp.date} | 출처: Yahoo Finance, SEC EDGAR, Toss Screener",
            "",
            "---",
            "",
            "## 1. 기업 개요 및 기본 정보",
            dp.overview,
            "",
            "---",
            "",
            "## 2. 재무 제표 (연간 시계열)",
            "",
            "### 손익계산서",
            "| 연도 | 매출액 | 매출총이익률 | 영업이익 | 영업이익률 | 순이익 | 순이익률 | EPS |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for r in dp.income_annual:
            gm = f"{r.gross_margin_pct:.1f}%" if r.gross_margin_pct is not None else "—"
            om = f"{r.operating_margin_pct:.1f}%" if r.operating_margin_pct is not None else "—"
            nm = f"{r.net_margin_pct:.1f}%" if r.net_margin_pct is not None else "—"
            eps = f"${r.eps:.2f}" if r.eps is not None else "—"
            lines.append(
                f"| {r.year} | {self._money(r.revenue)} | {gm} | {self._money(r.operating_income)} | {om} | {self._money(r.net_income)} | {nm} | {eps} |"
            )

        lines.extend([
            "",
            "### 현금흐름표",
            "| 연도 | 영업현금흐름 | CapEx | 잉여현금흐름(FCF) |",
            "|---|---|---|---|",
        ])
        for c in dp.cashflow_annual:
            lines.append(
                f"| {c.year} | {self._money(c.operating_cash_flow)} | {self._money(c.capex)} | {self._money(c.fcf)} |"
            )

        bs = dp.balance_sheet
        lines.extend([
            "",
            "### 재무상태표 및 안정성 지표",
            f"- **현금 및 단기투자자산**: {self._money(bs.cash_and_investments)}",
            f"- **총부채**: {self._money(bs.total_debt)}",
            f"- **순부채(Net Debt)**: {self._money(bs.net_debt)}",
            f"- **자기자본(Equity)**: {self._money(bs.stockholders_equity)}",
            f"- **부채비율**: {bs.debt_ratio:.2f}x" if bs.debt_ratio else "- **부채비율**: N/A",
            f"- **유동비율**: {bs.current_ratio:.2f}x" if bs.current_ratio else "- **유동비율**: N/A",
            f"- **ROE**: {bs.roe_pct:.1f}%" if bs.roe_pct else "- **ROE**: N/A",
            f"- **ROA**: {bs.roa_pct:.1f}%" if bs.roa_pct else "- **ROA**: N/A",
            "",
            "---",
            "",
            "## 3. 밸류에이션 및 시세 지표",
            f"- **현재가**: ${dp.current_price:.2f}",
            f"- **시가총액**: {self._money(dp.valuation.market_cap)}",
            f"- **Trailing PER**: {dp.valuation.trailing_pe:.2f}x" if dp.valuation.trailing_pe else "- **Trailing PER**: N/A",
            f"- **Forward PER**: {dp.valuation.forward_pe:.2f}x" if dp.valuation.forward_pe else "- **Forward PER**: N/A",
            f"- **PBR**: {dp.valuation.pbr:.2f}x" if dp.valuation.pbr else "- **PBR**: N/A",
            f"- **PSR**: {dp.valuation.psr:.2f}x" if dp.valuation.psr else "- **PSR**: N/A",
            f"- **PEG**: {dp.valuation.peg:.2f}x" if dp.valuation.peg else "- **PEG**: N/A",
            f"- **EV/EBITDA**: {dp.valuation.ev_ebitda:.2f}x" if dp.valuation.ev_ebitda else "- **EV/EBITDA**: N/A",
            f"- **배당수익률**: {dp.valuation.dividend_yield_pct:.2f}%" if dp.valuation.dividend_yield_pct else "- **배당수익률**: N/A",
            "",
            "---",
            "",
            "## 4. 시장 수급 및 애널리스트 컨센서스",
        ])
        for k, v in dp.market_metrics.items():
            lines.append(f"- **{k}**: {v}")
        for k, v in dp.analyst_consensus.items():
            lines.append(f"- **{k}**: {v}")

        lines.extend([
            "",
            "---",
            "*본 데이터팩은 13인의 거장 분석(Guru Report)을 위한 공용 팩트 자료입니다.*",
        ])

        return "\n".join(lines)
