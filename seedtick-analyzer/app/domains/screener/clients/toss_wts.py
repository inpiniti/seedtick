"""
토스증권 비공개 WTS 스크리너 클라이언트 (2차 폴백 소스)
"""
import asyncio
import logging
import time
import uuid
import httpx

logger = logging.getLogger("toss_wts_client")

INIT_URL = "https://wts-api.tossinvest.com/api/v3/init"
SCREEN_URL = "https://wts-cert-api.tossinvest.com/api/v2/screener/screen"
INFO_URL = "https://wts-info-api.tossinvest.com/api/v2/stock-infos"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)
APP_VERSION = "v260710.1801"
SESSION_TTL_SEC = 30 * 60
HTTP_TIMEOUT = 20.0

억 = 100_000_000


def _range(frm: float | None, to: float | None, include_from=True, include_to=False) -> dict:
    return {
        "id": "NUMBER_RANGE_DEFAULT",
        "type": "NUMBER_RANGE",
        "value": {
            "from": frm,
            "to": to,
            "includeFrom": include_from if frm is not None else None,
            "includeTo": include_to if to is not None else None,
        },
    }


def _period(period_id: str, value: str) -> dict:
    return {"id": period_id, "type": "PERIOD", "value": value}


def F(fid: str, frm=None, to=None, include_from=True, include_to=False) -> dict:
    return {"id": fid, "conditions": [_range(frm, to, include_from, include_to)]}


def FQ(fid: str, period: str, frm=None, to=None, include_from=True, include_to=False) -> dict:
    return {
        "id": fid,
        "conditions": [
            _period("기간_선택_QUARTER_TTM", period),
            _range(frm, to, include_from, include_to),
        ],
    }


COMMON_FILTERS = [
    F("시가총액", 3000 * 억),
    FQ("부채_비율", "TTM", None, 1, include_to=True),
    FQ("이자_보상_배율", "TTM", 3),
    FQ("영업_이익률", "TTM", 0.1),
    FQ("ROE", "TTM", 0.1),
]


class TossWtsClient:
    def __init__(self):
        self._lock = asyncio.Lock()
        self._client: httpx.AsyncClient | None = None
        self._xsrf_token: str | None = None
        self._issued_at: float = 0.0
        self._device_id: str = f"WTS-{uuid.uuid4().hex}"

    async def _issue_session(self) -> None:
        if self._client is not None:
            await self._client.aclose()

        self._client = httpx.AsyncClient(
            timeout=HTTP_TIMEOUT,
            headers={
                "user-agent": USER_AGENT,
                "accept": "application/json",
                "accept-language": "ko-KR,ko;q=0.9",
                "app-version": APP_VERSION,
                "referer": "https://www.tossinvest.com/screener",
            },
            follow_redirects=True,
        )
        self._client.cookies.set("deviceId", self._device_id, domain=".tossinvest.com")

        res = await self._client.get(INIT_URL)
        res.raise_for_status()

        token = self._client.cookies.get("XSRF-TOKEN")
        if not token:
            raise RuntimeError("토스 init 응답에 XSRF-TOKEN 쿠키가 없습니다.")

        self._xsrf_token = token
        self._issued_at = time.time()
        logger.info(f"[TossWTS] 세션 발급 완료 (deviceId={self._device_id[:12]}…)")

    async def _ensure_session(self, force: bool = False) -> None:
        async with self._lock:
            expired = (time.time() - self._issued_at) > SESSION_TTL_SEC
            if force or self._client is None or self._xsrf_token is None or expired:
                await self._issue_session()

    async def screen_common_us(self, size: int = 200, page: int = 1) -> dict:
        """13인 공통 필터로 미국 주식 조회 및 심볼 보강"""
        body = {
            "pagingParam": {"key": None, "number": page, "size": size},
            "filters": COMMON_FILTERS,
            "nation": "us",
        }

        raw = None
        for attempt in (1, 2):
            await self._ensure_session(force=(attempt == 2))
            assert self._client is not None and self._xsrf_token is not None

            res = await self._client.post(
                SCREEN_URL,
                json=body,
                headers={"x-xsrf-token": self._xsrf_token, "content-type": "application/json"},
            )
            if res.status_code == 200:
                raw = res.json()
                break
            if attempt == 1 and res.status_code in (400, 401, 403):
                logger.warning(f"[TossWTS] HTTP {res.status_code} — 세션 재발급 후 재시도")
                continue
            raise RuntimeError(f"토스 스크리너 조회 실패: HTTP {res.status_code} {res.text[:200]}")

        if not raw:
            raise RuntimeError("토스 스크리너 응답이 없습니다.")

        flat = self._flatten_result(raw)
        return await self._enrich_tickers(flat)

    def _flatten_result(self, raw: dict) -> dict:
        result = raw.get("result") or {}
        stocks = []
        for s in result.get("stocks") or []:
            row = {
                "ticker": (s.get("stockCode") or "").lstrip("A"),
                "stockCode": s.get("stockCode"),
                "name": s.get("name"),
                "logoImageUrl": s.get("logoImageUrl"),
                "price": (s.get("close") or {}).get("usd") or (s.get("close") or {}).get("krw"),
                "prevClose": (s.get("base") or {}).get("usd") or (s.get("base") or {}).get("krw"),
            }
            for col in s.get("columns") or []:
                value = col.get("value")
                if isinstance(value, dict):
                    value = value.get("usd") if value.get("usd") is not None else value.get("krw")
                row[col.get("label") or col.get("id")] = value
            stocks.append(row)

        return {
            "totalCount": result.get("totalCount", 0),
            "page": result.get("page", 1),
            "lastPage": result.get("lastPage", True),
            "count": len(stocks),
            "stocks": stocks,
        }

    async def _enrich_tickers(self, flat: dict) -> dict:
        stocks = flat.get("stocks") or []
        codes = [s.get("stockCode") for s in stocks if s.get("stockCode")]
        if not codes:
            return flat

        mapping = {}
        chunk_size = 100
        async with httpx.AsyncClient(
            timeout=HTTP_TIMEOUT,
            headers={"user-agent": USER_AGENT, "accept": "application/json"},
        ) as client:
            for i in range(0, len(codes), chunk_size):
                chunk = codes[i : i + chunk_size]
                try:
                    res = await client.get(f"{INFO_URL}?codes={','.join(chunk)}")
                    if res.status_code == 200:
                        for r in res.json().get("result") or []:
                            code, symbol = r.get("code"), r.get("symbol")
                            if code and symbol:
                                mapping[code] = symbol
                except Exception as e:
                    logger.warning(f"[TossWTS] 심볼 조회 오류: {e}")

        for s in stocks:
            sym = mapping.get(s.get("stockCode"))
            if sym:
                s["ticker"] = sym

        return flat

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
