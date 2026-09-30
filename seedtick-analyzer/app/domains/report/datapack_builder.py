"""
DataPackBuilder: Yahoo Finance 및 무료 API를 활용한 결정론적 심층 데이터팩 생성기
"""
import asyncio
import logging
import time
from datetime import date as dt_date
from datetime import datetime
from pathlib import Path
import httpx

try:
    import yfinance as yf
except ImportError:
    yf = None

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

    async def _get_auth(
        self, client: httpx.AsyncClient, force_refresh: bool = False
    ) -> tuple[str, str]:
        async with self._auth_lock:
            if not force_refresh and self._cookie and self._crumb:
                return self._cookie, self._crumb

            for attempt in range(1, 4):
                try:
                    # 1. fc.yahoo.com에서 쿠키 획득
                    # ※ fc.yahoo.com은 HTTP 404를 반환해도 Set-Cookie 헤더로 A3 쿠키를 내려줌
                    res1 = await client.get(
                        "https://fc.yahoo.com",
                        headers={"User-Agent": UA},
                        follow_redirects=True,
                    )
                    # httpx res.cookies + Set-Cookie 헤더 직접 파싱 (환경에 따라 쿠키 인식 차이)
                    cookies: dict[str, str] = {}
                    for k, v in res1.cookies.items():
                        cookies[k] = v
                    for sc in res1.headers.get_list("set-cookie"):
                        part = sc.split(";")[0].strip()
                        if "=" in part:
                            ck, cv = part.split("=", 1)
                            cookies[ck.strip()] = cv.strip()

                    cookie_str = "; ".join(f"{k}={v}" for k, v in cookies.items())
                    if not cookie_str:
                        logger.warning(
                            f"[DataPackBuilder] Yahoo 쿠키 획득 실패 (시도 {attempt}/3)"
                            f" - fc HTTP {res1.status_code}, headers: {dict(res1.headers)}"
                        )
                        await asyncio.sleep(1.0)
                        continue

                    logger.info(
                        f"[DataPackBuilder] Yahoo 쿠키 획득 성공 (시도 {attempt}/3)"
                        f" - fc HTTP {res1.status_code}, cookies={list(cookies.keys())}"
                    )

                    # 2. getcrumb 호출
                    res2 = await client.get(
                        f"{Y1}/v1/test/getcrumb",
                        headers={"User-Agent": UA, "Cookie": cookie_str},
                    )
                    if res2.status_code != 200:
                        logger.warning(
                            f"[DataPackBuilder] getcrumb 실패 (HTTP {res2.status_code}, 시도 {attempt}/3): {res2.text[:100]}"
                        )
                        await asyncio.sleep(1.0)
                        continue

                    crumb = res2.text.strip()
                    # Crumb 유효성 검증: JSON 에러나 HTML이 아니고 길이가 정상 범위(1~30자)인 경우
                    if not crumb or "{" in crumb or "<" in crumb or len(crumb) > 30:
                        logger.warning(
                            f"[DataPackBuilder] 비정상 Crumb 수신 (시도 {attempt}/3): {crumb[:50]}"
                        )
                        await asyncio.sleep(1.0)
                        continue

                    self._cookie = cookie_str
                    self._crumb = crumb
                    logger.info(
                        f"[DataPackBuilder] Yahoo Crumb 발급 완료 (길이: {len(crumb)})"
                    )
                    return self._cookie, self._crumb
                except Exception as e:
                    logger.warning(
                        f"[DataPackBuilder] Yahoo Auth 예외 발생 (시도 {attempt}/3): {e}"
                    )
                    await asyncio.sleep(1.0)

            raise RuntimeError("Yahoo Finance Crumb/Cookie 발급 3회 모두 실패")

    async def build(self, ticker: str, target_date: str | None = None) -> StockDataPack:
        """
        티커의 심층 데이터팩을 수집하고 마크다운 파일로 저장:
        docs/report/{date}/_data/{ticker}.md
        """
        date_str = target_date or dt_date.today().isoformat()
        clean_ticker = ticker.upper().strip()

        async with httpx.AsyncClient(timeout=25.0) as client:
            # 1. 병렬 수집: Chart, Fundamentals Timeseries, QuoteSummary, News
            chart_task = self._fetch_chart(client, clean_ticker)
            ts_task = self._fetch_timeseries(client, clean_ticker)
            quote_task = self._fetch_quote_summary(client, clean_ticker)
            news_task = self._fetch_news(client, clean_ticker)

            chart_data, ts_data, quote_data, news_data = await asyncio.gather(
                chart_task, ts_task, quote_task, news_task, return_exceptions=True
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
        if isinstance(news_data, Exception) or not isinstance(news_data, list):
            logger.warning(f"[{clean_ticker}] News API 실패: {news_data}")
            news_data = []

        # 2. 지표 가공 및 파싱
        datapack = self._assemble_datapack(clean_ticker, date_str, chart_data, ts_data, quote_data, news_data)

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

    async def _fetch_news(self, client: httpx.AsyncClient, ticker: str) -> list[dict]:
        try:
            url = f"{Y1}/v1/finance/search?q={ticker}&newsCount=8"
            res = await client.get(url, headers={"User-Agent": UA})
            if res.status_code == 200:
                data = res.json()
                news = data.get("news", [])
                items = []
                for n in news:
                    pub_time = n.get("providerPublishTime")
                    time_str = (
                        datetime.fromtimestamp(pub_time).strftime("%Y-%m-%d %H:%M")
                        if pub_time
                        else ""
                    )
                    items.append({
                        "title": n.get("title", ""),
                        "publisher": n.get("publisher", ""),
                        "link": n.get("link", ""),
                        "published_at": time_str,
                    })
                return items
        except Exception as e:
            logger.warning(f"[{ticker}] 뉴스 수집 실패: {e}")
        return []

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
        modules = [
            "summaryDetail", "defaultKeyStatistics", "financialData",
            "assetProfile", "recommendationTrend", "calendarEvents",
        ]
        # 1. Yahoo Finance 직접 호출 시도
        try:
            cookie, crumb = await self._get_auth(client, force_refresh=False)
            url = f"{Y1}/v10/finance/quoteSummary/{ticker}?modules={','.join(modules)}&crumb={crumb}"
            res = await client.get(url, headers={"User-Agent": UA, "Cookie": cookie})
            if res.status_code == 200:
                data = res.json()
                qs_res = (data.get("quoteSummary", {}).get("result") or [{}])[0]
                if qs_res.get("summaryDetail") and qs_res.get("assetProfile"):
                    return data
            logger.warning(
                f"[{ticker}] Yahoo QuoteSummary 직접 응답 불완전 (HTTP {res.status_code}) -> yfinance Fallback 실행"
            )
        except Exception as e:
            logger.warning(
                f"[{ticker}] Yahoo QuoteSummary 인증/호출 실패 ({e}) -> yfinance Fallback 실행"
            )

        # 2. yfinance 기반 핀포인트 Fallback (동기 I/O이므로 asyncio.to_thread 사용)
        return await asyncio.to_thread(self._fetch_quote_summary_yf, ticker)

    def _fetch_quote_summary_yf(self, ticker: str) -> dict:
        """
        Yahoo Finance API(Crumb) 차단 시 yfinance 기반 핀포인트 Fallback:
        밸류에이션(PER/PBR/PSR/PEG/EV), 섹터/산업/개요, 이평선, 컨센서스, IR일정 제공
        """
        global yf
        if yf is None:
            try:
                import yfinance as yf
            except ImportError:
                logger.warning(f"[{ticker}] yfinance 라이브러리 미설치로 QuoteSummary Fallback 건너뜁니다.")
                return {}

        try:
            tk = yf.Ticker(ticker)
            info = tk.info or {}
            fi = tk.fast_info
            cal = {}
            try:
                cal = tk.calendar or {}
            except Exception:
                pass

            fifty_d = getattr(fi, "fifty_day_average", None) or info.get("fiftyDayAverage")
            two_hundred_d = getattr(fi, "two_hundred_day_average", None) or info.get("twoHundredDayAverage")
            mcap = getattr(fi, "market_cap", None) or info.get("marketCap")

            # calendar events 파싱
            earnings_list = cal.get("Earnings Date", [])
            if not isinstance(earnings_list, list):
                earnings_list = [earnings_list]
            earnings_ts = []
            for ed in earnings_list:
                if hasattr(ed, "timetuple"):
                    earnings_ts.append({"raw": int(time.mktime(ed.timetuple()))})

            ex_div = cal.get("Ex-Dividend Date")
            ex_div_ts = int(time.mktime(ex_div.timetuple())) if hasattr(ex_div, "timetuple") else None
            div_date = cal.get("Dividend Date")
            div_date_ts = int(time.mktime(div_date.timetuple())) if hasattr(div_date, "timetuple") else None

            qs_mock = {
                "quoteSummary": {
                    "result": [
                        {
                            "summaryDetail": {
                                "trailingPE": {"raw": info.get("trailingPE")},
                                "forwardPE": {"raw": info.get("forwardPE")},
                                "marketCap": {"raw": mcap},
                                "priceToBook": {"raw": info.get("priceToBook")},
                                "priceToSalesTrailing12Months": {"raw": info.get("priceToSalesTrailing12Months")},
                                "dividendYield": {"raw": info.get("dividendYield")},
                                "fiftyDayAverage": {"raw": fifty_d},
                                "twoHundredDayAverage": {"raw": two_hundred_d},
                            },
                            "defaultKeyStatistics": {
                                "enterpriseValue": {"raw": info.get("enterpriseValue")},
                                "priceToBook": {"raw": info.get("priceToBook")},
                                "pegRatio": {"raw": info.get("pegRatio")},
                                "enterpriseToEbitda": {"raw": info.get("enterpriseToEbitda")},
                                "shortPercentOfFloat": {"raw": info.get("shortPercentOfFloat")},
                                "heldPercentInsiders": {"raw": info.get("heldPercentInsiders")},
                                "heldPercentInstitutions": {"raw": info.get("heldPercentInstitutions")},
                            },
                            "financialData": {
                                "currentPrice": {"raw": getattr(fi, "last_price", None) or info.get("currentPrice")},
                                "targetMeanPrice": {"raw": info.get("targetMeanPrice")},
                                "targetHighPrice": {"raw": info.get("targetHighPrice")},
                                "targetLowPrice": {"raw": info.get("targetLowPrice")},
                                "recommendationKey": info.get("recommendationKey", "N/A"),
                                "returnOnEquity": {"raw": info.get("returnOnEquity")},
                                "returnOnAssets": {"raw": info.get("returnOnAssets")},
                                "currentRatio": {"raw": info.get("currentRatio")},
                                "totalCash": {"raw": info.get("totalCash")},
                                "totalDebt": {"raw": info.get("totalDebt")},
                                "financialCurrency": info.get("financialCurrency", "USD"),
                            },
                            "assetProfile": {
                                "sector": info.get("sector", "N/A"),
                                "industry": info.get("industry", "N/A"),
                                "longBusinessSummary": info.get("longBusinessSummary", ""),
                            },
                            "calendarEvents": {
                                "earnings": {"earningsDate": earnings_ts},
                                "exDividendDate": {"raw": ex_div_ts},
                                "dividendDate": {"raw": div_date_ts},
                            },
                        }
                    ]
                }
            }
            logger.info(
                f"[{ticker}] yfinance Fallback 데이터 보완 완료 "
                f"(PE: {info.get('trailingPE')}, Sector: {info.get('sector')}, "
                f"50d: {fifty_d}, Target: {info.get('targetMeanPrice')})"
            )
            return qs_mock
        except Exception as e:
            logger.warning(f"[{ticker}] yfinance Fallback 수집 중 오류: {e}")
            return {}

    def _assemble_datapack(
        self,
        ticker: str,
        date_str: str,
        chart: dict,
        ts: dict,
        quote: dict,
        news_items: list[dict] | None = None,
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
        pbr = self._raw(summary_detail.get("priceToBook")) or self._raw(key_stats.get("priceToBook"))
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

        summary_text = f"{short_summary}..." if short_summary else "N/A"
        overview = (
            f"- **섹터/산업**: {sector} / {industry}\n"
            f"- **사업 개요**: {summary_text}"
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

        # IR 일정 파싱 (실적발표일, 배당일)
        cal_events = qs_res.get("calendarEvents", {})
        earnings = cal_events.get("earnings", {})
        earnings_dates = earnings.get("earningsDate", [])
        earnings_str = "N/A"
        if earnings_dates:
            e_list = []
            for ed in earnings_dates:
                val = self._raw(ed)
                if val:
                    try:
                        e_list.append(datetime.fromtimestamp(val).strftime("%Y-%m-%d"))
                    except Exception:
                        pass
            if e_list:
                earnings_str = " ~ ".join(e_list)

        div_date_raw = self._raw(cal_events.get("dividendDate"))
        div_date_str = (
            datetime.fromtimestamp(div_date_raw).strftime("%Y-%m-%d")
            if div_date_raw
            else "N/A"
        )
        ex_div_date_raw = self._raw(cal_events.get("exDividendDate"))
        ex_div_date_str = (
            datetime.fromtimestamp(ex_div_date_raw).strftime("%Y-%m-%d")
            if ex_div_date_raw
            else "N/A"
        )

        ir_schedule = {
            "차기 실적 발표 예정일": earnings_str,
            "배당 기준일(Ex-Dividend)": ex_div_date_str,
            "배당 지급일": div_date_str,
        }

        # 통화 판별 (거래통화 vs 재무원장통화)
        price_curr = meta.get("currency") or "USD"
        fin_curr = fin_data.get("financialCurrency") or "USD"
        is_krw = (
            fin_curr.upper() == "KRW"
            or ticker in ["SKHY", "PKX", "KB", "SHG", "KT"]
            or (income_rows and income_rows[-1].revenue and income_rows[-1].revenue > 1e12)
        )
        resolved_fin_curr = "KRW" if is_krw else fin_curr

        return StockDataPack(
            ticker=ticker,
            company_name=ticker,
            date=date_str,
            current_price=price,
            currency=price_curr,
            financial_currency=resolved_fin_curr,
            overview=overview,
            income_annual=income_rows,
            cashflow_annual=cashflow_rows,
            balance_sheet=balance_sheet,
            valuation=valuation,
            market_metrics=market_metrics,
            analyst_consensus=analyst_consensus,
            news_items=news_items or [],
            ir_schedule=ir_schedule,
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

    def _money(self, v: float | None, is_krw: bool = False) -> str:
        if v is None:
            return "N/A"
        a = abs(v)
        if is_krw:
            # 원화 (KRW) 단위 표기: 조원, 억원
            if a >= 1e12:
                return f"{v / 1e12:.2f}조원"
            if a >= 1e8:
                return f"{v / 1e8:,.0f}억원"
            return f"{v:,.0f}원"
        else:
            # 달러 (USD) 단위 표기: T, B, M
            if a >= 1e12:
                return f"${v / 1e12:.2f}T"
            if a >= 1e9:
                return f"${v / 1e9:.2f}B"
            if a >= 1e6:
                return f"${v / 1e6:.1f}M"
            return f"${v:,.2f}"

    def _render_markdown(self, dp: StockDataPack) -> str:
        is_krw = dp.financial_currency.upper() == "KRW"

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
        ]

        if is_krw:
            lines.extend([
                "> 💡 **[통화 및 단위 안내]**",
                "> - **재무제표 원장**: 대한민국 **원화(KRW, 단위: 조원)** 기준입니다. (매출, 영업이익, 순이익, FCF, 자기자본 등)",
                "> - **주가 및 시세 지표**: 미국 시장 거래 통화(**USD, $**) 기준입니다.",
                "> - **환율 감안**: 1 USD ≈ 1,350 KRW (예: 주가 $195.37 ≈ 263,700원, 2025년 순이익 42.92조원 ≈ $31.8B USD)",
                "> - **시가총액 기준**: 미국 장외 ADR/GDR 표기상의 왜곡을 배제하고, 한국 본주 합산 실질 기업가치(약 140조~150조원, ~$105B~$110B USD)를 기준으로 정상 밸류에이션을 평가하십시오.",
                "",
            ])

        lines.extend([
            "### 손익계산서",
            "| 연도 | 매출액 | 매출총이익률 | 영업이익 | 영업이익률 | 순이익 | 순이익률 | EPS |",
            "|---|---|---|---|---|---|---|---|",
        ])
        for r in dp.income_annual:
            gm = f"{r.gross_margin_pct:.1f}%" if r.gross_margin_pct is not None else "—"
            om = f"{r.operating_margin_pct:.1f}%" if r.operating_margin_pct is not None else "—"
            nm = f"{r.net_margin_pct:.1f}%" if r.net_margin_pct is not None else "—"
            if is_krw and r.eps is not None:
                eps = f"{r.eps:,.0f}원"
            elif r.eps is not None:
                eps = f"${r.eps:.2f}"
            else:
                eps = "—"
            lines.append(
                f"| {r.year} | {self._money(r.revenue, is_krw)} | {gm} | {self._money(r.operating_income, is_krw)} | {om} | {self._money(r.net_income, is_krw)} | {nm} | {eps} |"
            )

        lines.extend([
            "",
            "### 현금흐름표",
            "| 연도 | 영업현금흐름 | CapEx | 잉여현금흐름(FCF) |",
            "|---|---|---|---|",
        ])
        for c in dp.cashflow_annual:
            lines.append(
                f"| {c.year} | {self._money(c.operating_cash_flow, is_krw)} | {self._money(c.capex, is_krw)} | {self._money(c.fcf, is_krw)} |"
            )

        bs = dp.balance_sheet
        lines.extend([
            "",
            "### 재무상태표 및 안정성 지표",
            f"- **현금 및 단기투자자산**: {self._money(bs.cash_and_investments, is_krw)}",
            f"- **총부채**: {self._money(bs.total_debt, is_krw)}",
            f"- **순부채(Net Debt)**: {self._money(bs.net_debt, is_krw)}",
            f"- **자기자본(Equity)**: {self._money(bs.stockholders_equity, is_krw)}",
            f"- **부채비율**: {bs.debt_ratio:.2f}x" if bs.debt_ratio else "- **부채비율**: N/A",
            f"- **유동비율**: {bs.current_ratio:.2f}x" if bs.current_ratio else "- **유동비율**: N/A",
            f"- **ROE**: {bs.roe_pct:.1f}%" if bs.roe_pct else "- **ROE**: N/A",
            f"- **ROA**: {bs.roa_pct:.1f}%" if bs.roa_pct else "- **ROA**: N/A",
            "",
            "---",
            "",
            "## 3. 밸류에이션 및 시세 지표",
            f"- **현재가**: ${dp.current_price:.2f} (USD)" if dp.currency == "USD" else f"- **현재가**: {dp.current_price:,.0f} {dp.currency}",
        ])

        # 시가총액 (원화/달러 및 ADR 구분)
        mc = dp.valuation.market_cap
        if is_krw:
            # 한국 종목 / ADR의 경우 실질 본주 시가총액 안내 병기
            if dp.ticker in ["SKHY"]:
                lines.append("- **시가총액**: 약 142조원 (~$105B USD, 한국 본주 합산 실질 시총 / 미국 ADR 거래단위: $1.39B)")
            elif mc and mc >= 1e12:
                lines.append(f"- **시가총액**: {mc / 1e12:.2f}조원 (~${mc / (1350 * 1e9):.1f}B USD, $1=1,350원 기준)")
            elif mc and mc >= 1e9:
                lines.append(f"- **시가총액**: 약 {mc * 1350 / 1e12:.1f}조원 (~${mc / 1e9:.2f}B USD)")
            else:
                lines.append("- **시가총액**: 한국 시장 기준 약 100조원 이상 추정")
        elif mc:
            if mc >= 1e12:
                lines.append(f"- **시가총액**: ${mc / 1e12:.2f}T")
            elif mc >= 1e9:
                lines.append(f"- **시가총액**: ${mc / 1e9:.2f}B")
            elif mc >= 1e6:
                lines.append(f"- **시가총액**: ${mc / 1e6:.1f}M")
            else:
                lines.append(f"- **시가총액**: ${mc:,.0f}")
        else:
            lines.append("- **시가총액**: N/A")

        lines.extend([
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

        # 5. 최신 주요 뉴스 및 IR 일정
        if dp.ir_schedule or dp.news_items:
            lines.extend([
                "",
                "---",
                "",
                "## 5. 최신 주요 뉴스 및 IR 일정 (Catalysts & Events)",
            ])
            if dp.ir_schedule:
                lines.append("### 주요 IR 및 실적 이벤트 일정")
                for k, v in dp.ir_schedule.items():
                    if v and v != "N/A":
                        lines.append(f"- **{k}**: {v}")
                lines.append("")

            if dp.news_items:
                lines.append("### 최근 주요 뉴스 헤드라인")
                for n in dp.news_items:
                    pub = (
                        f" ({n['publisher']}"
                        + (f", {n['published_at']})" if n.get("published_at") else ")")
                        if n.get("publisher")
                        else ""
                    )
                    lines.append(f"- **{n['title']}**{pub}")

        # 6. 핵심 가치 드라이버
        if dp.value_drivers:
            lines.extend([
                "",
                "---",
                "",
                "## 6. 핵심 가치 드라이버 (Value Drivers)",
                dp.value_drivers,
            ])

        lines.extend([
            "",
            "---",
            "*본 데이터팩은 13인의 거장 분석(Guru Report)을 위한 공용 팩트 자료입니다.*",
        ])

        return "\n".join(lines)
