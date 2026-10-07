"""
토스증권 비공개 WTS 스크리너 클라이언트 (직접 호출)
13인의 거장 필터 및 공통 필터를 토스 WTS API로 직접 조회합니다.
로그인 불필요 (익명 세션/토큰 발급 방식).
"""
import asyncio
import logging
import time
import uuid
from typing import Any

import httpx

logger = logging.getLogger("toss_wts_client")

INIT_URL = "https://wts-api.tossinvest.com/api/v3/init"
SCREEN_URL = "https://wts-cert-api.tossinvest.com/api/v2/screener/screen"
INFO_URL = "https://wts-info-api.tossinvest.com/api/v2/stock-infos"
SEARCH_URL = "https://wts-info-api.tossinvest.com/api/v2/search/stocks"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)
APP_VERSION = "v260710.1801"
SESSION_TTL_SEC = 30 * 60  # 30분 TTL
HTTP_TIMEOUT = 20.0

억 = 100_000_000
조 = 1_000_000_000_000


# ──────────────────────────────────────────────────────────────
# 필터 빌더 헬퍼
# ──────────────────────────────────────────────────────────────

def _range(
    frm: float | None,
    to: float | None,
    include_from: bool = True,
    include_to: bool = False,
) -> dict:
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
    """기간 없는 숫자범위 필터"""
    return {"id": fid, "conditions": [_range(frm, to, include_from, include_to)]}


def FQ(fid: str, period: str, frm=None, to=None, include_from=True, include_to=False) -> dict:
    """재무 지표 필터 (QUARTER | TTM)"""
    return {
        "id": fid,
        "conditions": [
            _period("기간_선택_QUARTER_TTM", period),
            _range(frm, to, include_from, include_to),
        ],
    }


def FY(fid: str, period: str, frm=None, to=None, include_from=True, include_to=False) -> dict:
    """연평균 지표 필터 (TTM_3 | TTM_5)"""
    return {
        "id": fid,
        "conditions": [
            _period("기간_선택_TTM3_TTM5", period),
            _range(frm, to, include_from, include_to),
        ],
    }


def FD(fid: str, period: str, frm=None, to=None, include_from=True, include_to=False) -> dict:
    """시세 지표 필터 (DAY_1 ~ DAY_240)"""
    return {
        "id": fid,
        "conditions": [
            _period("기간_선택_DAY_TO_YEAR", period),
            _range(frm, to, include_from, include_to),
        ],
    }


def 신저가(within_days: int, weeks: int) -> dict:
    return {
        "id": "CUSTOM_N주_신저가_달성_경과일",
        "conditions": [{
            "id": "WEEK_NEW_PRICE_HIT",
            "type": "WEEK_NEW_PRICE_HIT_WITHIN",
            "value": {"within": within_days, "numberOfWeeks": weeks},
        }],
    }


def 이동평균선_배열(short: int = 5, mid: int = 20, long: int = 60, within: int = 1, align: str = "positive") -> dict:
    return {
        "id": "CUSTOM_이동평균선_배열",
        "conditions": [{
            "id": "이동평균선_배열",
            "type": "MOVING_AVERAGE_ALIGN_ARRAY",
            "value": [{
                "shortPeriod": short,
                "midPeriod": mid,
                "longPeriod": long,
                "within": within,
                "alignType": align,
            }],
        }],
    }


# ──────────────────────────────────────────────────────────────
# 13인의 거장 필터 세트
# ──────────────────────────────────────────────────────────────

GURU_PRESETS: dict[str, dict[str, Any]] = {
    "공통": {
        "name": "13인 공통분모",
        "style": "합의",
        "principle": "어느 스타일로 가든 이걸 깔고 시작하라 — 13인이 가장 많이 겹친 조건만 모았다.",
        "filters": [
            F("시가총액", 3000 * 억),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
            FQ("이자_보상_배율", "TTM", 3),
            FQ("영업_이익률", "TTM", 0.1),
            FQ("ROE", "TTM", 0.1),
        ],
        "tighten": "ROE·영업이익률을 15%로 상향",
        "loosen": "이자보상배율 제거 → 시가총액 1,000억으로 완화 (부채비율은 절대 먼저 풀지 말 것)",
    },
    "그레이엄": {
        "name": "벤저민 그레이엄",
        "style": "가치 · 안전마진",
        "principle": "스크리너는 헐값 후보를 고를 뿐, 내재가치는 계산해주지 않는다.",
        "filters": [
            F("시가총액", 3000 * 억),
            F("PER", 0, 15, include_to=True),
            F("PBR", 0, 1.5, include_to=True),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
            FQ("유동_비율", "TTM", 2),
            FQ("순이익_연속_증가", "TTM", 4),
        ],
        "tighten": "이자보상배율 500%↑ 또는 배당 연속지급 7년↑ 추가",
        "loosen": "순이익 연속증가 4→2년 → 유동비율 200→100% → PBR 1.5→2배 (PER·PBR 상한은 마지막)",
    },
    "클라먼": {
        "name": "세스 클라먼",
        "style": "가치 · 안전마진",
        "principle": "오를 종목이 아니라, 틀려도 원금을 지킬 헐값만 거른다.",
        "filters": [
            F("주가", 1000, None, include_from=False),
            F("PBR", 0, 1),
            F("PER", 0, 10),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
            FQ("이자_보상_배율", "TTM", 5),
            FQ("영업_이익률", "TTM", 0.1),
        ],
        "tighten": "부채비율 100→50% 이하, PBR 1→0.7배",
        "loosen": "이자보상배율 500→300%, 부채비율 200% 이하 (PER·PBR은 안전마진의 본체이니 마지막)",
    },
    "파브라이": {
        "name": "모니시 파브라이",
        "style": "가치 · 단도투자",
        "principle": "앞면이면 크게 벌고, 뒷면이어도 별로 안 잃는 조합만 남긴다.",
        "filters": [
            F("시가총액", 1000 * 억),
            F("PER", 0, 10),
            F("PBR", 0, 1),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
            FQ("이자_보상_배율", "TTM", 3),
            FQ("ROE", "TTM", 0.05),
        ],
        "tighten": "PBR 0.7배 또는 ROE 10%",
        "loosen": "이자보상배율 제거 후 시가총액 하한 인하",
    },
    "그린블라트": {
        "name": "조엘 그린블라트",
        "style": "마법공식 (가장 단순)",
        "principle": "좋은 기업(ROC)을 싼값(EY)에. EV/EBITDA + ROA로 마법공식을 근사한다.",
        "filters": [
            F("시가총액", 3000 * 억),
            F("EV_EBITDA", 0, 10),
            FQ("ROA", "TTM", 0.1),
            FQ("영업_이익률", "TTM", 0.1),
        ],
        "tighten": "EV/EBITDA 8배로 (ROA·영업이익률은 건드리지 말 것)",
        "loosen": "시가총액 1,000억으로 인하",
        "note": "ROE 대신 ROA를 쓰는 이유: ROE는 부채로 부풀릴 수 있다.",
    },
    "코스톨라니": {
        "name": "앙드레 코스톨라니",
        "style": "대형 우량",
        "principle": "스크리너는 개(주가)만 재고 주인(경제·심리)은 못 잰다.",
        "filters": [
            F("시가총액", 1 * 조),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
            FQ("이자_보상_배율", "TTM", 5),
            FQ("ROE", "TTM", 0.1),
            F("PER", 0, 15, include_to=True),
            FQ("영업_이익_연속_증가", "TTM", 3),
        ],
        "tighten": "PER 15→10배, ROE 10→15%",
        "loosen": "이자보상배율 500→300%, 영업이익 연속증가 3→2년",
    },
    "슈웨거": {
        "name": "잭 슈웨거",
        "style": "추세 ⚠️ (템플턴과 정반대)",
        "principle": "스크리너는 후보를 걸러줄 뿐, 손절선을 그어주지는 않는다.",
        "filters": [
            FD("거래대금", "DAY_20", 100 * 억),
            이동평균선_배열(5, 20, 60, within=1, align="positive"),
            FY("연평균_순이익_증감률", "TTM_3", 0.2),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
        ],
        "tighten": "거래량 비율 200%↑ 또는 52주 신고가 추가",
        "loosen": "연평균 순이익 증감률 20→10% (거래대금·부채비율은 리스크 관리 마지노선)",
        "note": "⚠️ 템플턴(신저가)과 동시에 켜면 결과가 0개가 된다.",
    },
    "버핏": {
        "name": "워런 버핏",
        "style": "퀄리티 · 해자",
        "principle": "싼 주식이 아니라, 숫자에 새겨진 해자의 흔적을 찾는다.",
        "filters": [
            F("시가총액", 3000 * 억),
            FQ("매출_총_이익률", "TTM", 0.4),
            FQ("ROE", "TTM", 0.15),
            FQ("순_이익률", "TTM", 0.15),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
            FQ("순이익_연속_증가", "TTM", 3),
        ],
        "tighten": "매출총이익률 40→50%, 순이익 연속증가 3→4년",
        "loosen": "시가총액 1,000억, 부채비율 150%",
    },
    "피셔": {
        "name": "필립 피셔",
        "style": "성장 · 스커틀벗",
        "principle": "스크리너는 발로 뛸 후보를 추려주는 문지기일 뿐이다.",
        "filters": [
            FY("연평균_매출액_증감률", "TTM_3", 0.2),
            FQ("영업_이익률", "TTM", 0.1),
            FQ("영업_이익_연속_증가", "TTM", 3),
            FY("연평균_순이익_증감률", "TTM_3", 0.1),
            FQ("부채_비율", "TTM", None, 2, include_to=True),
        ],
        "tighten": "매출 증감률 20→30%, 순이익 증감률 10→20%",
        "loosen": "영업이익 연속증가 3→2년",
    },
    "뉴욕주민": {
        "name": "뉴욕주민",
        "style": "퀄리티 · 데이터 회의주의",
        "principle": "증감률이 아니라 연속증가를 봐라 — 일회성 손익 하나로 증감률은 수십 % 튄다.",
        "filters": [
            F("시가총액", 3000 * 억),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
            FQ("이자_보상_배율", "TTM", 3),
            FQ("영업_이익률", "TTM", 0.1),
            FQ("ROE", "TTM", 0.1),
            FQ("순이익_연속_증가", "TTM", 3),
            F("PER", 0, 20, include_to=True),
        ],
        "tighten": "PER 20→15배 또는 시가총액 1조↑",
        "loosen": "이자보상배율 제거, 순이익 연속증가 3→2년",
    },
    "린치": {
        "name": "피터 린치",
        "style": "PEG (성장주를 싸게)",
        "principle": "PER 20배 ÷ 성장률 20% = PEG 1.0 — 내 마지노선이다.",
        "filters": [
            F("시가총액", 1000 * 억),
            F("PER", 0, 20),
            FY("연평균_순이익_증감률", "TTM_3", 0.2),
            FQ("부채_비율", "TTM", None, 1, include_to=True),
            FQ("영업_이익률", "TTM", 0.1),
            FD("거래대금", "DAY_1", 5 * 억),
        ],
        "tighten": "순이익 증감률 20→30% 또는 PER 20→15배 (PEG 0.75)",
        "loosen": "영업이익률 조건부터 제거",
    },
    "다모다란": {
        "name": "애스워스 다모다란",
        "style": "가치 + 가치함정 방벽",
        "principle": "스크리너는 가격(pricing) 도구지 가치(valuation) 도구가 아니다.",
        "filters": [
            F("시가총액", 3000 * 억),
            F("주가", 1000, None, include_from=False),
            F("PER", 0, 15, include_to=True),
            F("PBR", 0, 1.5, include_to=True),
            FQ("ROE", "TTM", 0.1),
            FQ("영업_이익률", "TTM", 0.1),
            FQ("이자_보상_배율", "TTM", 3),
            FQ("부채_비율", "TTM", None, 2, include_to=True),
            FY("연평균_순이익_증감률", "TTM_3", 0.1),
        ],
        "tighten": "PER 15→12배, ROE 10→12%",
        "loosen": "PBR 1.5→2배",
    },
    "템플턴": {
        "name": "존 템플턴",
        "style": "역발상 ⚠️ (슈웨거와 정반대)",
        "principle": "최대 비관의 순간이 최고의 매수 시점 — 단, 재무 안정성으로 그물코를 걸러라.",
        "filters": [
            F("시가총액", 3000 * 억),
            신저가(within_days=3, weeks=52),
            F("PER", 0, 20),
            FQ("부채_비율", "QUARTER", None, 1, include_to=True),
            FQ("이자_보상_배율", "TTM", 3),
        ],
        "tighten": "이자보상배율 500%, PER 상한 15배",
        "loosen": "신저가 52주→12주, 3일 이내→20일 이내",
    },
    "버리": {
        "name": "마이클 버리",
        "style": "소외 소형주 ⚠️ (시가총액이 나머지와 정반대)",
        "principle": "스크리너는 냄새나는 자루를 골라줄 뿐, 열어서 읽는 건 내 몫이다.",
        "filters": [
            F("시가총액", 300 * 억, 3000 * 억),
            F("PBR", 0, 1),
            F("EV_EBITDA", 0, 10),
            FQ("부채_비율", "QUARTER", None, 2, include_to=True),
            FD("거래대금", "DAY_20", 5 * 억),
        ],
        "tighten": "EV/EBITDA 8배로",
        "loosen": "부채비율 조건 제거",
    },
}

COMMON_FILTERS = GURU_PRESETS["공통"]["filters"]

GURU_ALIASES: dict[str, str] = {
    "공통": "공통", "common": "공통", "공통분모": "공통", "종합": "공통", "all": "공통", "전체": "공통",
    "벤저민": "그레이엄", "그레이엄": "그레이엄", "벤저민-그레이엄": "그레이엄", "graham": "그레이엄",
    "세스": "클라먼", "클라먼": "클라먼", "세스-클라먼": "클라먼", "klarman": "클라먼",
    "모니시": "파브라이", "파브라이": "파브라이", "모니시-파브라이": "파브라이", "pabrai": "파브라이",
    "조엘": "그린블라트", "그린블라트": "그린블라트", "조엘-그린블라트": "그린블라트", "greenblatt": "그린블라트",
    "앙드레": "코스톨라니", "코스톨라니": "코스톨라니", "앙드레-코스톨라니": "코스톨라니", "kostolany": "코스톨라니",
    "잭": "슈웨거", "슈웨거": "슈웨거", "잭-슈웨거": "슈웨거", "schwager": "슈웨거",
    "워런": "버핏", "버핏": "버핏", "워런-버핏": "버핏", "buffett": "버핏",
    "필립": "피셔", "피셔": "피셔", "필립-피셔": "피셔", "fisher": "피셔",
    "뉴욕주민": "뉴욕주민", "newyorker": "뉴욕주민",
    "피터": "린치", "린치": "린치", "피터-린치": "린치", "lynch": "린치",
    "애스워스": "다모다란", "다모다란": "다모다란", "애스워스-다모다란": "다모다란", "damodaran": "다모다란",
    "존": "템플턴", "템플턴": "템플턴", "존-템플턴": "템플턴", "templeton": "템플턴",
    "마이클": "버리", "버리": "버리", "마이클-버리": "버리", "burry": "버리",
}


def resolve_guru(key: str) -> str | None:
    """별칭을 정규 키로 변환. 없으면 None."""
    if not key:
        return None
    cleaned = key.strip()
    # 1. 원본 그대로 또는 소문자
    res = GURU_ALIASES.get(cleaned.lower()) or GURU_ALIASES.get(cleaned)
    if res:
        return res
    # 2. 공백 -> 하이픈 변환 ("워런 버핏" -> "워런-버핏")
    hyphenated = cleaned.replace(" ", "-")
    res = GURU_ALIASES.get(hyphenated.lower()) or GURU_ALIASES.get(hyphenated)
    if res:
        return res
    # 3. 공백/하이픈 제거 ("워런 버핏" -> "워런버핏")
    compact = cleaned.replace(" ", "").replace("-", "")
    res = GURU_ALIASES.get(compact.lower()) or GURU_ALIASES.get(compact)
    return res


# ──────────────────────────────────────────────────────────────
# TossWtsClient 본체
# ──────────────────────────────────────────────────────────────

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

    async def ensure_session(self, force: bool = False) -> None:
        await self._ensure_session(force=force)

    async def get_session_info(self) -> dict:
        age = time.time() - self._issued_at if self._issued_at else None
        return {
            "active": self._xsrf_token is not None,
            "device_id": self._device_id,
            "xsrf_token_prefix": (self._xsrf_token[:8] + "…") if self._xsrf_token else None,
            "age_sec": round(age) if age is not None else None,
            "ttl_sec": SESSION_TTL_SEC,
            "expires_in_sec": round(SESSION_TTL_SEC - age) if age is not None else None,
        }

    async def screen(
        self,
        filters: list[dict],
        nation: str = "us",
        size: int = 200,
        page: int = 1,
        sort: dict | None = None,
    ) -> dict:
        """토스 스크리너 API 호출"""
        body: dict[str, Any] = {
            "pagingParam": {"key": None, "number": page, "size": size},
            "filters": filters,
            "nation": nation.lower(),
        }
        if sort:
            body["sort"] = sort

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

        return raw

    async def screen_by_guru(
        self,
        guru_key: str,
        nation: str = "us",
        size: int = 200,
        page: int = 1,
    ) -> dict:
        """거장 프리셋으로 스크리너 조회 및 심볼 보강"""
        key = resolve_guru(guru_key)
        if key is None or key not in GURU_PRESETS:
            raise KeyError(f"'{guru_key}' 프리셋이 없습니다. 사용 가능: {', '.join(GURU_PRESETS.keys())}")

        preset = GURU_PRESETS[key]
        raw = await self.screen(preset["filters"], nation=nation, size=size, page=page)
        flat = self._flatten_result(raw, nation=nation)
        enriched = await self._enrich_tickers(flat, nation=nation)

        return {
            "guru": key,
            "name": preset["name"],
            "style": preset["style"],
            "principle": preset["principle"],
            "tighten": preset.get("tighten"),
            "loosen": preset.get("loosen"),
            "note": preset.get("note"),
            "filterCount": len(preset["filters"]),
            **enriched,
        }

    async def get_guru_screener(
        self,
        guru: str = "공통",
        nation: str = "us",
        size: int = 200,
        page: int = 1,
        client: httpx.AsyncClient | None = None,
    ) -> dict:
        """BtcAiTossClient 호환 인터페이스 메서드"""
        return await self.screen_by_guru(guru_key=guru, nation=nation, size=size, page=page)

    async def get_all_gurus_screeners(
        self,
        gurus: list[str],
        nation: str = "us",
        size: int = 200,
        page: int = 1,
    ) -> list[tuple[str, dict | Exception]]:
        """여러 거장 스크리너를 직접 병렬 조회"""
        # 세션을 사전에 한 번 발급/확인하여 병렬 요청 시 락 경합 방지
        await self._ensure_session()

        async def _fetch_safe(g: str) -> tuple[str, dict | Exception]:
            for attempt in range(2):
                try:
                    res = await self.screen_by_guru(guru_key=g, nation=nation, size=size, page=page)
                    return g, res
                except Exception as e:
                    if attempt == 0:
                        await asyncio.sleep(0.5)
                    else:
                        logger.warning(f"[TossWtsClient] '{g}' 스크리너 조회 최종 실패: {e}")
                        return g, e
            return g, RuntimeError("스크리너 조회 실패")

        tasks = [_fetch_safe(g) for g in gurus]
        return await asyncio.gather(*tasks)

    async def screen_common(self, nation: str = "us", size: int = 200, page: int = 1) -> dict:
        """13인 공통 필터로 주식 조회 및 심볼 보강"""
        return await self.screen_by_guru(guru_key="공통", nation=nation, size=size, page=page)

    async def screen_common_us(self, size: int = 200, page: int = 1) -> dict:
        """[Deprecated] screen_common(nation='us') 위임 래퍼 — 하위 호환성 유지"""
        return await self.screen_common(nation="us", size=size, page=page)

    def _flatten_result(self, raw: dict, nation: str = "us") -> dict:
        result = raw.get("result") or {}
        stocks = []
        is_us = nation.lower() == "us"
        for s in result.get("stocks") or []:
            close_dict = s.get("close") or {}
            base_dict = s.get("base") or {}
            price = (close_dict.get("usd") if is_us else close_dict.get("krw")) or close_dict.get("usd") or close_dict.get("krw")
            prev_close = (base_dict.get("usd") if is_us else base_dict.get("krw")) or base_dict.get("usd") or base_dict.get("krw")

            row = {
                "ticker": (s.get("stockCode") or "").lstrip("A"),
                "stockCode": s.get("stockCode"),
                "name": s.get("name"),
                "logoImageUrl": s.get("logoImageUrl"),
                "price": price,
                "prevClose": prev_close,
            }
            for col in s.get("columns") or []:
                value = col.get("value")
                if isinstance(value, dict):
                    value = (value.get("usd") if is_us else value.get("krw")) or value.get("usd") or value.get("krw")
                row[col.get("label") or col.get("id")] = value
            stocks.append(row)

        return {
            "totalCount": result.get("totalCount", 0),
            "page": result.get("page", 1),
            "lastPage": result.get("lastPage", True),
            "count": len(stocks),
            "stocks": stocks,
        }

    async def _enrich_tickers(self, flat: dict, nation: str = "us") -> dict:
        if not nation or nation.lower() != "us":
            return flat

        stocks = flat.get("stocks") or []
        codes = [s.get("stockCode") for s in stocks if s.get("stockCode")]
        if not codes:
            return flat

        infos = await self._fetch_stock_infos_by_codes(codes)
        mapping: dict[str, str] = {}
        for info in infos:
            code, symbol = info.get("code"), info.get("symbol")
            if code and symbol:
                mapping[code] = symbol

        for s in stocks:
            sym = mapping.get(s.get("stockCode"))
            if sym:
                s["ticker"] = sym

        return flat

    async def _fetch_stock_infos_by_codes(self, codes: list[str]) -> list[dict]:
        normalized_codes = [c for c in codes if c]
        if not normalized_codes:
            return []

        results: list[dict] = []
        chunk_size = 100
        async with httpx.AsyncClient(
            timeout=HTTP_TIMEOUT,
            headers={
                "user-agent": USER_AGENT,
                "accept": "application/json",
                "referer": "https://www.tossinvest.com/",
            },
        ) as client:
            for i in range(0, len(normalized_codes), chunk_size):
                chunk = normalized_codes[i : i + chunk_size]
                try:
                    res = await client.get(f"{INFO_URL}?codes={','.join(chunk)}")
                    if res.status_code == 200:
                        results.extend(res.json().get("result") or [])
                except Exception as e:
                    logger.warning(f"[TossWTS] stock-infos 조회 오류: {e}")
        return results

    async def search_stocks(self, query: str) -> list[dict]:
        normalized = (query or "").strip()
        if not normalized:
            return []

        body = {"query": normalized}
        async with httpx.AsyncClient(
            timeout=HTTP_TIMEOUT,
            headers={
                "user-agent": USER_AGENT,
                "accept": "application/json",
                "content-type": "application/json",
                "referer": "https://www.tossinvest.com/",
            },
            follow_redirects=True,
        ) as client:
            res = await client.post(SEARCH_URL, json=body)
            if res.status_code != 200:
                logger.warning(
                    f"[TossWTS] 종목 검색 실패(query={normalized}): HTTP {res.status_code}"
                )
                return []
            return (res.json().get("result") or {}).get("stocks") or []

    async def _find_logo_via_search(self, ticker: str) -> dict[str, str] | None:
        normalized = (ticker or "").strip().upper()
        if not normalized:
            return None

        candidates = await self.search_stocks(normalized)
        stock_codes = [c.get("stockCode") for c in candidates if c.get("stockCode")]
        if not stock_codes:
            return None

        infos = await self._fetch_stock_infos_by_codes(stock_codes)
        for info in infos:
            symbol = (info.get("symbol") or "").strip().upper()
            logo_image_url = info.get("logoImageUrl")
            if symbol == normalized and logo_image_url:
                return {
                    "ticker": symbol,
                    "stock_code": info.get("code") or "",
                    "logo_image_url": logo_image_url,
                }
        return None

    async def find_logo_by_ticker(
        self,
        ticker: str,
        nation: str = "us",
        size: int = 200,
        max_pages: int = 3,
    ) -> dict[str, str] | None:
        """
        공통 스크리너 페이지를 순회해 특정 티커의 logoImageUrl을 탐색합니다.
        - Toss API가 logo 조회용 단일 엔드포인트를 공개하지 않아 스크리너 결과를 활용합니다.
        """
        normalized = (ticker or "").strip().upper()
        if not normalized:
            return None

        # 1) 토스 검색 API 기반 조회 (ticker -> stockCode -> logoImageUrl)
        via_search = await self._find_logo_via_search(normalized)
        if via_search:
            return via_search

        # 2) 폴백: 공통 스크리너 결과를 순회하면서 로고 탐색
        for page in range(1, max_pages + 1):
            try:
                data = await self.screen_common(nation=nation, size=size, page=page)
            except Exception as e:
                logger.warning(f"[TossWTS] 로고 조회용 스크리너 탐색 실패 ({normalized}, page={page}): {e}")
                continue

            stocks = data.get("stocks") or []
            for stock in stocks:
                symbol = (stock.get("ticker") or "").strip().upper()
                logo_image_url = stock.get("logoImageUrl")
                if symbol == normalized and logo_image_url:
                    return {
                        "ticker": symbol,
                        "stock_code": stock.get("stockCode") or "",
                        "logo_image_url": logo_image_url,
                    }

            if data.get("lastPage", True):
                break

        return None

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
