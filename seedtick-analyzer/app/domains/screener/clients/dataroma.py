"""
DataRoma Grand Portfolio 클라이언트 (두번째 스크리너)

- https://www.dataroma.com/m/g/portfolio.php?o=c (Ownership count 내림차순)
- <table id="grid"> HTML을 파싱해 슈퍼인베스터들이 공동 보유한 종목을 수집
- 기본 필터: 동일 종목을 보유한 투자자 수 10명 이상
- 별도 라이브러리(BeautifulSoup 등) 없이 정규식 + 표준 라이브러리만 사용
"""
import logging
import re
from html import unescape

import httpx

logger = logging.getLogger("dataroma_client")

PORTFOLIO_URL = "https://www.dataroma.com/m/g/portfolio.php?o=c"
HTTP_TIMEOUT = 20.0
MIN_HOLDERS_DEFAULT = 10

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)

_TBODY_RE = re.compile(r"<tbody>(.*?)</tbody>", re.S | re.I)
_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)
_CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.S | re.I)


def _cell_text(raw: str) -> str:
    """<td> 내부 HTML을 텍스트로 정규화 (태그 제거 + HTML 엔티티 디코딩)"""
    return unescape(_TAG_RE.sub("", raw)).replace("\xa0", " ").strip()


def _to_float(text: str) -> float | None:
    """'$748,851.77' / '1.779' / '-' 같은 셀 값을 float로 변환"""
    cleaned = text.replace("$", "").replace(",", "").replace("%", "").strip()
    if not cleaned or cleaned in {"-", "N/A", "n/a", "NA"}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _to_int(text: str) -> int | None:
    value = _to_float(text)
    return int(value) if value is not None else None


def parse_grand_portfolio(html: str, min_holders: int = MIN_HOLDERS_DEFAULT) -> list[dict]:
    """
    DataRoma Grand Portfolio 표(<table id="grid">)를 파싱합니다.

    셀 순서: Symbol | Stock | % | Ownership count | Hold Price | Max % |
             Current Price | 52W Low | % Above 52W Low | 52W High

    Returns:
        min_holders 이상 보유한 종목 dict 리스트 (페이지 정렬 순서 유지, 티커 중복 제거)
    """
    body_match = _TBODY_RE.search(html)
    if not body_match:
        raise RuntimeError("DataRoma 응답 HTML에서 보유 종목 표(<tbody>)를 찾지 못했습니다.")

    rows: list[dict] = []
    seen: set[str] = set()

    for row_match in _ROW_RE.finditer(body_match.group(1)):
        cells = [_cell_text(c) for c in _CELL_RE.findall(row_match.group(1))]
        if len(cells) < 10:
            continue

        ticker = cells[0].upper()
        if not ticker or ticker.upper() == "SYMBOL":
            continue

        holders = _to_int(cells[3])
        if holders is None or holders < min_holders:
            continue

        if ticker in seen:
            continue
        seen.add(ticker)

        rows.append(
            {
                "ticker": ticker,
                "name": cells[1] or ticker,
                "weight_pct": _to_float(cells[2]),       # %
                "holders": holders,                       # Ownership count
                "hold_price": _to_float(cells[4]),        # Hold Price*
                "max_pct": _to_float(cells[5]),           # Max %
                "price": _to_float(cells[6]),             # Current Price
                "week52_low": _to_float(cells[7]),        # 52 Week Low
                "pct_above_52w_low": _to_float(cells[8]), # % Above 52 Week Low
                "week52_high": _to_float(cells[9]),       # 52 Week High
            }
        )

    return rows


class DataromaClient:
    """DataRoma Grand Portfolio 스크레이핑 클라이언트"""

    async def fetch_grand_portfolio(
        self, min_holders: int = MIN_HOLDERS_DEFAULT
    ) -> list[dict]:
        """
        Grand Portfolio(소유자 수 내림차순)를 조회해 min_holders 이상 보유 종목 반환

        Raises:
            RuntimeError: 응답 파싱 실패 시
            httpx.HTTPError: 네트워크/HTTP 오류 시
        """
        headers = {
            "user-agent": USER_AGENT,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9",
            "referer": "https://www.dataroma.com/m/g/portfolio.php",
        }

        async with httpx.AsyncClient(
            timeout=HTTP_TIMEOUT, headers=headers, follow_redirects=True
        ) as client:
            res = await client.get(PORTFOLIO_URL)
            res.raise_for_status()
            html = res.text

        rows = parse_grand_portfolio(html, min_holders=min_holders)
        logger.info(
            f"[Dataroma] 그랜드 포트폴리오 파싱 완료: "
            f"보유자 {min_holders}명 이상 {len(rows)}개 종목"
        )
        return rows

    async def close(self) -> None:
        """하위 호환용 빈 메서드 (클라이언트가 요청마다 생성됨)"""
        return None
