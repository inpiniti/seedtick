"""
리포트 산출물 구조화(Structuring) 모듈

AI 응답·데이터팩·마스터 보고서를 "검색/정렬/집계 가능한 DB 행"으로 변환하는 순수 함수 모음.
실시간 파이프라인(service.sync_to_db)과 과거 데이터 백필(scripts/backfill_structured.py)이
같은 규칙을 쓰도록 이 모듈 하나로 모은다.

- extract_json_object : AI 응답에서 JSON 객체 추출 (```json 블록 → 첫 {...} 순)
- parse_number        : "$1,234.5", "12.3%", "1.2T" 같은 문자열 → float
- parse_price_range   : "$150~$175", "$160 이하" → (low, high)
- build_*_row(s)      : guru_reports 확장 컬럼 / guru_opinions / report_metrics 행 생성
- extract_master_sections : 마크다운 마스터 보고서에서 결론·강세·약세·드라이버 목록 추출 (JSON 폴백/백필용)
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.config.constants import GURU_REPORT_ROSTER, GURU_REPORT_PERSONA_KEYS, VERDICT_SCORE_MAP

VERDICTS = ("매수", "보유", "관망", "매도")

_NUM_RE = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")
_SUFFIX = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}


# ── 기본 파서 ─────────────────────────────────────────────
def extract_json_object(text: str | None) -> dict | None:
    """AI 응답 텍스트에서 첫 번째 유효한 JSON 객체를 추출한다."""
    if not text:
        return None
    candidates = [m.group(1) for m in re.finditer(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)]
    # 코드블록이 없으면 가장 바깥 {...} 를 시도
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])
    for cand in candidates:
        try:
            obj = json.loads(cand)
        except (json.JSONDecodeError, ValueError):
            continue
        if isinstance(obj, dict):
            return obj
    return None


def parse_number(value: Any) -> float | None:
    """숫자/문자열에서 첫 숫자를 float로 변환. 'N/A'·빈값은 None. K/M/B/T 접미사 지원."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text or text.upper() in {"N/A", "NA", "NONE", "NULL", "-", "—", "해당 없음"}:
        return None
    m = _NUM_RE.search(text.replace(" ", ""))
    if not m:
        return None
    try:
        num = float(m.group(0).replace(",", ""))
    except ValueError:
        return None
    tail = text.replace(" ", "")[m.end() : m.end() + 1].upper()
    return num * _SUFFIX.get(tail, 1.0)


def parse_price_range(text: Any) -> tuple[float | None, float | None]:
    """'$150~$175' → (150, 175), '$160 이하' → (None, 160), '$200 이상' → (200, None), '$180' → (180, 180)."""
    if text is None:
        return None, None
    s = str(text)
    nums = [parse_number(n) for n in _NUM_RE.findall(s.replace(" ", ""))]
    nums = [n for n in nums if n is not None]
    if not nums:
        return None, None
    if len(nums) >= 2:
        return min(nums[0], nums[1]), max(nums[0], nums[1])
    only = nums[0]
    if "이하" in s or "미만" in s:
        return None, only
    if "이상" in s or "초과" in s:
        return only, None
    return only, only


def normalize_verdict(value: Any) -> str | None:
    """'관망 (Hold)' / '**매수**' 등에서 4개 의견 키워드 중 첫 번째를 반환."""
    if value is None:
        return None
    s = str(value)
    hits = [(s.find(v), v) for v in VERDICTS if v in s]
    return min(hits)[1] if hits else None


def as_str_list(value: Any, limit: int | None = None) -> list[str]:
    """str | list → 공백 제거된 문자열 리스트."""
    if value is None:
        return []
    items = value if isinstance(value, list) else [value]
    out = [str(v).strip().strip("-•* ").strip() for v in items if v is not None]
    out = [v for v in out if v]
    return out[:limit] if limit else out


def format_price_range(low: float | None, high: float | None, symbol: str = "$") -> str | None:
    def fmt(v: float) -> str:
        return f"{symbol}{v:,.0f}" if abs(v) >= 100 else f"{symbol}{v:,.2f}"

    if low is not None and high is not None:
        return fmt(low) if low == high else f"{fmt(low)} ~ {fmt(high)}"
    if high is not None:
        return f"{fmt(high)} 이하"
    if low is not None:
        return f"{fmt(low)} 이상"
    return None


def pct_change(target: float | None, base: float | None) -> float | None:
    if target is None or not base:
        return None
    return round((target / base - 1.0) * 100.0, 2)


# ── 마스터 보고서 마크다운 섹션 추출 (JSON 실패 폴백 / 과거 데이터 백필용) ──
def _section(markdown: str, header_keywords: tuple[str, ...]) -> str:
    for kw in header_keywords:
        m = re.search(rf"^##\s*\d*\.?\s*[^\n]*{kw}[^\n]*\n(.*?)(?=^##\s|\Z)", markdown, re.M | re.S)
        if m:
            return m.group(1)
    return ""


def _bullets(section: str, limit: int = 6) -> list[str]:
    items: list[str] = []
    for line in section.splitlines():
        s = line.strip()
        if not s or s.startswith(("|", ">", "```", "#")):
            continue
        s = re.sub(r"^(?:[-*•]|\d+[.)])\s*", "", s).strip().strip("*_` ")
        if len(s) >= 8:
            items.append(s)
        if len(items) >= limit:
            break
    return items


def extract_master_sections(markdown: str | None) -> dict[str, Any]:
    md = markdown or ""
    conclusion_sec = _section(md, ("종합 결론",))
    conclusion = ""
    m = re.search(r"종합\s*결론\**\s*[:：]\s*\**(.+)", conclusion_sec)
    if m:
        conclusion = m.group(1).strip().strip("*_` ")
    elif conclusion_sec:
        bl = _bullets(conclusion_sec, 1)
        conclusion = bl[0] if bl else ""
    return {
        "conclusion": conclusion,
        "bull_points": _bullets(_section(md, ("강세론", "Bull"))),
        "bear_points": _bullets(_section(md, ("약세론", "Bear"))),
        "key_drivers": _bullets(_section(md, ("드라이버", "KPI"))),
        "hot_topics": _bullets(_section(md, ("핵심 쟁점",)), 4),
    }


# ── 집계 ───────────────────────────────────────────────────
def count_votes(summaries: list[dict]) -> dict[str, int]:
    counts = {v: 0 for v in VERDICTS}
    for s in summaries:
        v = s.get("verdict")
        if (
            s.get("persona") in GURU_REPORT_PERSONA_KEYS
            and s.get("parse_mode") != "fallback"
            and v in counts
        ):
            counts[v] += 1
    return counts


def guru_index(persona: str) -> int | None:
    """페르소나 키(예: '워런-버핏') → guru_votes g1~g13 인덱스."""
    normalized = " ".join(persona.strip().replace("-", " ").split())
    for idx, (display_name, persona_key) in enumerate(GURU_REPORT_ROSTER, start=1):
        if normalized in {persona_key.replace("-", " "), display_name}:
            return idx
        # Legacy reports called the official g9 persona "뉴욕주민".
        if idx == 9 and normalized == "뉴욕주민":
            return idx
    return None


# ── DB 행 생성 ─────────────────────────────────────────────
def build_opinion_rows(
    report_id: str,
    date_str: str,
    ticker: str,
    current_price: float | None,
    summaries: list[dict],
    prompt_version: str | None = None,
    raw_texts: dict[str, str] | None = None,
) -> list[dict]:
    """guru_opinions 행 (리포트 × 거장 1행)."""
    rows: list[dict] = []
    for s in summaries:
        persona = s.get("persona") or ""
        low, high = s.get("target_price_low"), s.get("target_price_high")
        if low is None and high is None:
            low, high = parse_price_range(s.get("target_price_range"))
        mid = (low + high) / 2 if (low is not None and high is not None) else (low or high)
        verdict = s.get("verdict") if s.get("verdict") in VERDICTS else "관망"
        rows.append(
            {
                "report_id": report_id,
                "d": date_str,
                "ticker": ticker.upper(),
                "persona": persona,
                "guru_idx": guru_index(persona),
                "verdict": verdict,
                "score": VERDICT_SCORE_MAP.get(verdict, 2),
                "confidence": s.get("confidence"),
                "target_low": low,
                "target_high": high,
                "target_text": s.get("target_price_range"),
                "upside_pct": pct_change(mid, current_price),
                "arguments": as_str_list(s.get("core_arguments")),
                "triggers": as_str_list(s.get("trigger_conditions")),
                "quote": s.get("quote"),
                "parse_mode": s.get("parse_mode") or "legacy",
                "prompt_version": prompt_version,
                "raw_text": (raw_texts or {}).get(persona) or None,
            }
        )
    return rows


def _latest(rows: list[dict] | None) -> dict:
    return rows[-1] if rows else {}


def build_metrics_row(report_id: str, date_str: str, ticker: str, datapack: dict) -> dict:
    """report_metrics 행: 데이터팩의 핵심 지표를 숫자 컬럼으로 평탄화."""
    val = datapack.get("valuation") or {}
    bs = datapack.get("balance_sheet") or {}
    inc = _latest(datapack.get("income_annual"))
    cf = _latest(datapack.get("cashflow_annual"))
    mm = datapack.get("market_metrics") or {}
    ac = datapack.get("analyst_consensus") or {}
    price = parse_number(datapack.get("current_price") or val.get("current_price"))
    target_mean = parse_number(ac.get("목표주가 평균"))
    high52 = parse_number(mm.get("52주 고가"))
    rec = ac.get("투자의견")
    return {
        "report_id": report_id,
        "d": date_str,
        "ticker": ticker.upper(),
        "current_price": price,
        "market_cap": parse_number(val.get("market_cap")),
        "enterprise_value": parse_number(val.get("enterprise_value")),
        "per": parse_number(val.get("trailing_pe")),
        "fwd_per": parse_number(val.get("forward_pe")),
        "peg": parse_number(val.get("peg")),
        "pbr": parse_number(val.get("pbr")),
        "psr": parse_number(val.get("psr")),
        "pfcf": parse_number(val.get("pfcf")),
        "ev_ebitda": parse_number(val.get("ev_ebitda")),
        "dividend_yield_pct": parse_number(val.get("dividend_yield_pct")),
        "roe_pct": parse_number(bs.get("roe_pct")),
        "roa_pct": parse_number(bs.get("roa_pct")),
        "roic_pct": parse_number(bs.get("roic_pct")),
        "debt_ratio": parse_number(bs.get("debt_ratio")),
        "current_ratio": parse_number(bs.get("current_ratio")),
        "net_debt": parse_number(bs.get("net_debt")),
        "fiscal_year": inc.get("year"),
        "revenue": parse_number(inc.get("revenue")),
        "revenue_growth_pct": parse_number(inc.get("revenue_growth_pct")),
        "gross_margin_pct": parse_number(inc.get("gross_margin_pct")),
        "operating_margin_pct": parse_number(inc.get("operating_margin_pct")),
        "net_margin_pct": parse_number(inc.get("net_margin_pct")),
        "eps": parse_number(inc.get("eps")),
        "fcf": parse_number(cf.get("fcf")),
        "fcf_margin_pct": parse_number(cf.get("fcf_margin_pct")),
        "high_52w": high52,
        "low_52w": parse_number(mm.get("52주 저가")),
        "from_52w_high_pct": pct_change(price, high52),
        "ma50": parse_number(mm.get("50일 이동평균선")),
        "ma200": parse_number(mm.get("200일 이동평균선")),
        "short_float_pct": parse_number(mm.get("공매도 비율(Short % of Float)")),
        "insider_pct": parse_number(mm.get("내부자 지분율")),
        "institution_pct": parse_number(mm.get("기관 지분율")),
        "analyst_target_mean": target_mean,
        "analyst_target_high": parse_number(ac.get("목표주가 최고")),
        "analyst_target_low": parse_number(ac.get("목표주가 최저")),
        "analyst_upside_pct": pct_change(target_mean, price),
        "analyst_rating": rec if rec and rec != "N/A" else None,
    }


def build_report_columns(
    *,
    current_price: float | None,
    summaries: list[dict],
    fair_value: float | None,
    target_price_band: str | None,
    safety_entry_price: str | None,
    optimistic_target_price: str | None,
    band_low: float | None = None,
    band_high: float | None = None,
    safety_entry_value: float | None = None,
    target_sell_value: float | None = None,
    conclusion: str = "",
    hot_topics: list[str] | None = None,
    bull_points: list[str] | None = None,
    bear_points: list[str] | None = None,
    key_drivers: list[str] | None = None,
    action_guide: dict | None = None,
    review_flags: list[str] | None = None,
    parse_mode: str | None = None,
    prompt_version: str | None = None,
    dispersion_pct: float | None = None,
    price_estimate_count: int | None = None,
) -> dict:
    """guru_reports 확장 컬럼 (정렬/필터 대상)."""
    if band_low is None and band_high is None:
        band_low, band_high = parse_price_range(target_price_band)
    if safety_entry_value is None:
        _, safety_entry_value = parse_price_range(safety_entry_price)
        if safety_entry_value is None:
            safety_entry_value = parse_number(safety_entry_price)
    if target_sell_value is None:
        target_sell_value = parse_number(optimistic_target_price)
    votes = count_votes(summaries)
    confs = [
        s.get("confidence")
        for s in summaries
        if s.get("persona") in GURU_REPORT_PERSONA_KEYS
        and s.get("parse_mode") != "fallback"
        and isinstance(s.get("confidence"), (int, float))
    ]
    return {
        "fair_value": fair_value,
        "band_low": band_low,
        "band_high": band_high,
        "safety_entry": safety_entry_value,
        "target_sell": target_sell_value,
        "upside_pct": pct_change(fair_value, current_price),
        "votes_buy": votes["매수"],
        "votes_hold": votes["보유"],
        "votes_watch": votes["관망"],
        "votes_sell": votes["매도"],
        "avg_confidence": round(sum(confs) / len(confs), 2) if confs else None,
        "dispersion_pct": round(dispersion_pct, 2)
        if isinstance(dispersion_pct, (int, float))
        else None,
        "price_estimate_count": price_estimate_count
        if isinstance(price_estimate_count, int)
        else None,
        "conclusion": conclusion or None,
        "hot_topics": hot_topics or [],
        "bull_points": bull_points or [],
        "bear_points": bear_points or [],
        "key_drivers": key_drivers or [],
        "action_guide": action_guide or {},
        "valuation_flags": review_flags or [],
        "parse_mode": parse_mode,
        "prompt_version": prompt_version,
    }
