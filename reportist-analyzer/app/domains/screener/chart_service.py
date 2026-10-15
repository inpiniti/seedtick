"""
ChartService: Yahoo Finance 기반 일봉 캔들스틱 수집 및 볼린저 밴드(20일 SMA, 2표준편차) 계산 서비스
"""
import logging
import math
import time
from datetime import datetime
import httpx

from app.domains.screener.models import (
    BollingerPoint,
    BollingerSummary,
    CandleItem,
    StockChartResponse,
)

logger = logging.getLogger("chart_service")

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
YAHOO_HOSTS = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
]

_CHART_CACHE: dict[str, tuple[float, StockChartResponse]] = {}
CHART_CACHE_TTL_SECONDS = 300  # 5분 메모리 캐시 (장중/야간 반복 요청 부하 완화)
_KR_SYMBOL_CACHE: dict[str, str] = {}  # 한국 종목코드(.KS / .KQ) 판별 결과 캐시


def clear_chart_cache():
    """테스트 및 수동 초기화용 캐시 비우기"""
    _CHART_CACHE.clear()
    _KR_SYMBOL_CACHE.clear()


def normalize_yahoo_ticker(ticker: str) -> str:
    """Yahoo Finance는 미국 클래스형 종목을 점(.) 대신 하이픈(-)으로 요구하나, 한국(.KS, .KQ)은 점(.)을 유지해야 한다."""
    symbol = (ticker or "").strip().upper()
    if not symbol:
        return symbol
    if symbol.endswith(".KS") or symbol.endswith(".KQ"):
        return symbol
    return symbol.replace(".", "-").replace(" ", "")


class ChartService:
    def __init__(self, timeout: float = 6.0):
        self.timeout = timeout

    async def fetch_raw_yahoo_chart(
        self, ticker: str, range_period: str = "6mo", interval: str = "1d"
    ) -> dict:
        """Yahoo Finance v8 Chart API 호출 (한국 종목 .KS / .KQ 및 query1/query2 멀티 호스트 폴백)"""
        clean_ticker = ticker.upper().strip()
        candidates: list[str] = []
        if clean_ticker in _KR_SYMBOL_CACHE:
            candidates = [_KR_SYMBOL_CACHE[clean_ticker]]
        elif clean_ticker.isdigit() and len(clean_ticker) == 6:
            # 6자리 한국 종목 코드: KOSPI(.KS) 및 KOSDAQ(.KQ) 순차 시도
            candidates = [f"{clean_ticker}.KS", f"{clean_ticker}.KQ"]
        else:
            candidates = [normalize_yahoo_ticker(clean_ticker)]

        last_error: Exception | None = None
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for symbol in candidates:
                for base_url in YAHOO_HOSTS:
                    url = f"{base_url}/v8/finance/chart/{symbol}?range={range_period}&interval={interval}"
                    try:
                        res = await client.get(url, headers={"User-Agent": UA})
                        if res.status_code == 200:
                            if clean_ticker.isdigit() and len(clean_ticker) == 6:
                                _KR_SYMBOL_CACHE[clean_ticker] = symbol
                            return res.json()
                        if res.status_code == 404:
                            last_error = httpx.HTTPStatusError(
                                "404 Not Found", request=res.request, response=res
                            )
                            break
                        res.raise_for_status()
                    except Exception as e:
                        last_error = e
                        continue

        if last_error:
            if isinstance(last_error, httpx.HTTPStatusError) and last_error.response.status_code == 404:
                raise ValueError(f"[{clean_ticker}] Yahoo Finance에서 종목 차트를 찾을 수 없습니다.") from last_error
            raise last_error
        raise ValueError(f"[{clean_ticker}] 차트 데이터를 가져오지 못했습니다.")

    def calculate_bollinger(
        self, dates: list[str], closes: list[float], period: int = 20, k: float = 2.0
    ) -> list[BollingerPoint]:
        """
        일봉 종가 시계열 기반 볼린저 밴드(SMA period, k * std) 계산
        """
        points: list[BollingerPoint] = []
        n = len(closes)

        for i in range(n):
            date_str = dates[i]
            if i < period - 1:
                points.append(
                    BollingerPoint(
                        time=date_str,
                        upper=None,
                        middle=None,
                        lower=None,
                        percent_b=None,
                    )
                )
                continue

            window = closes[i - period + 1 : i + 1]
            mean_val = sum(window) / period
            variance = sum((x - mean_val) ** 2 for x in window) / period
            std_val = math.sqrt(variance)

            upper_val = round(mean_val + (k * std_val), 2)
            lower_val = round(mean_val - (k * std_val), 2)
            middle_val = round(mean_val, 2)
            current_close = closes[i]

            band_width_span = upper_val - lower_val
            if band_width_span > 0:
                percent_b = round((current_close - lower_val) / band_width_span, 4)
            else:
                percent_b = 0.5

            points.append(
                BollingerPoint(
                    time=date_str,
                    upper=upper_val,
                    middle=middle_val,
                    lower=lower_val,
                    percent_b=percent_b,
                )
            )

        return points

    def determine_status(
        self, close: float, upper: float, middle: float, lower: float
    ) -> BollingerSummary:
        """
        현재가와 볼린저 밴드 수치를 바탕으로 상태 판정 요약 생성
        """
        band_width_span = upper - lower
        bandwidth = round((upper - lower) / middle, 4) if middle > 0 else 0.0

        if band_width_span > 0:
            percent_b = round((close - lower) / band_width_span, 4)
        else:
            percent_b = 0.5

        if close > upper or percent_b > 1.0:
            status = "UPPER_BREAK"
            status_label = "상단 돌파"
            status_desc = "볼린저 밴드 상단을 강하게 돌파한 과열/모멘텀 구간이에요."
        elif percent_b >= 0.8:
            status = "UPPER_NEAR"
            status_label = "상단 밴드 근접"
            status_desc = "볼린저 밴드 상단 저항선(상위 20%)에 근접해 있어요."
        elif percent_b > 0.2:
            status = "MIDDLE"
            status_label = "중심선 영역"
            status_desc = "볼린저 밴드 중심선 부근에서 안정적인 추세를 유지하고 있어요."
        elif percent_b >= 0.0:
            status = "LOWER_NEAR"
            status_label = "하단 밴드 근접"
            status_desc = "볼린저 밴드 하단 지지선(하위 20%)에 근접한 저점 매수 관심 구간이에요."
        else:
            status = "LOWER_BREAK"
            status_label = "하단 이탈"
            status_desc = "볼린저 밴드 하단을 하향 이탈한 극단적 과매도 구간이에요."

        return BollingerSummary(
            current_price=round(close, 2),
            upper=round(upper, 2),
            middle=round(middle, 2),
            lower=round(lower, 2),
            percent_b=percent_b,
            bandwidth=bandwidth,
            status=status,
            status_label=status_label,
            status_description=status_desc,
        )

    async def get_stock_chart(
        self, ticker: str, range_period: str = "6mo", interval: str = "1d"
    ) -> StockChartResponse:
        """
        티커의 일봉 차트 데이터 및 볼린저 밴드 계산 최종 응답 생성 (In-memory TTL 캐시 적용)
        """
        clean_ticker = ticker.upper().strip()
        # 토스 종목코드(예: US19890516001, NAS0250224006)가 들어온 경우 심볼로 자동 역변환
        resolved_ticker = clean_ticker
        from app.domains.screener.clients.toss_wts import is_toss_stock_code, TossWtsClient
        if is_toss_stock_code(clean_ticker):
            sym = await TossWtsClient.resolve_stock_code_async(clean_ticker)
            if sym:
                resolved_ticker = sym

        # 1. 캐시 확인
        cache_key = f"{resolved_ticker}:{range_period}:{interval}"
        now = time.time()
        cached = _CHART_CACHE.get(cache_key)
        if cached:
            cached_time, cached_res = cached
            if now - cached_time < CHART_CACHE_TTL_SECONDS:
                return cached_res

        data = await self.fetch_raw_yahoo_chart(resolved_ticker, range_period, interval)

        chart_result = data.get("chart", {}).get("result", [])
        if not chart_result:
            raise ValueError(f"[{resolved_ticker}] 유효한 차트 데이터를 찾을 수 없어요.")

        res_obj = chart_result[0]
        timestamps = res_obj.get("timestamp", [])
        indicators = res_obj.get("indicators", {})
        quote = indicators.get("quote", [{}])[0]

        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])

        candles: list[CandleItem] = []
        valid_dates: list[str] = []
        valid_closes: list[float] = []

        last_valid_close = 0.0

        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            o = opens[i] if i < len(opens) else None
            h = highs[i] if i < len(highs) else None
            l = lows[i] if i < len(lows) else None
            v = volumes[i] if i < len(volumes) else None

            # 결측치 정제
            if c is None or o is None or h is None or l is None:
                continue

            last_valid_close = float(c)
            date_str = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")

            candles.append(
                CandleItem(
                    time=date_str,
                    open=round(float(o), 2),
                    high=round(float(h), 2),
                    low=round(float(l), 2),
                    close=round(float(c), 2),
                    volume=int(v) if v is not None else 0,
                )
            )
            valid_dates.append(date_str)
            valid_closes.append(float(c))

        bollinger_points = self.calculate_bollinger(valid_dates, valid_closes)

        # 최신 시점 볼린저 밴드 요약 판정
        summary = None
        if bollinger_points:
            latest_b = bollinger_points[-1]
            if (
                latest_b.upper is not None
                and latest_b.middle is not None
                and latest_b.lower is not None
            ):
                summary = self.determine_status(
                    close=last_valid_close,
                    upper=latest_b.upper,
                    middle=latest_b.middle,
                    lower=latest_b.lower,
                )

        response = StockChartResponse(
            ticker=resolved_ticker,
            period=range_period,
            interval=interval,
            candles=candles,
            bollinger=bollinger_points,
            summary=summary,
        )

        # 2. 캐시 등록 및 LRU 초과 정리
        _CHART_CACHE[cache_key] = (now, response)
        if len(_CHART_CACHE) > 1000:
            for k in list(_CHART_CACHE.keys())[:200]:
                _CHART_CACHE.pop(k, None)

        return response
