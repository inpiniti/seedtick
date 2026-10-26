"""Build the final report around deterministic vote and price aggregation."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

from app.config.constants import GURU_REPORT_ROSTER
from app.domains.report.ai_client import AiGatewayClient
from app.domains.report.decision_engine import (
    EXPECTED_PERSONA_COUNT,
    MIN_VALID_PERSONAS,
    ReportConsensus,
    aggregate_report_consensus,
)
from app.domains.report.models import (
    FinalMasterReport,
    GuruSummaryDoc,
    StockDataPack,
)
from app.domains.report.structuring import as_str_list, extract_json_object, format_price_range

logger = logging.getLogger("master_report_builder")

GURU_EN_NAME_MAP = {
    "벤저민 그레이엄": "Benjamin Graham",
    "세스 클라먼": "Seth Klarman",
    "모니시 파브라이": "Mohnish Pabrai",
    "조엘 그린블라트": "Joel Greenblatt",
    "앙드레 코스톨라니": "André Kostolany",
    "잭 슈웨거": "Jack Schwager",
    "워런 버핏": "Warren Buffett",
    "필립 피셔": "Philip Fisher",
    "찰리 멍거": "Charlie Munger",
    "피터 린치": "Peter Lynch",
    "애스워스 다모다란": "Aswath Damodaran",
    "존 템플턴": "John Templeton",
    "마이클 버리": "Michael Burry",
}

GURU_EN_THESIS_MAP = {
    "벤저민 그레이엄": "Net-Current-Asset Value (NCAV) & Absolute Margin of Safety (P/E < 15, P/B < 1.5)",
    "세스 클라먼": "Margin of Safety, Unlevered Balance Sheet & Downside Capital Preservation",
    "모니시 파브라이": "Dhandho Framework (Heads I win, tails I don't lose much) & Low Risk / High Uncertainty",
    "조엘 그린블라트": "Magic Formula Ranking (High Return on Capital / ROIC + High Earnings Yield)",
    "앙드레 코스톨라니": "Anticyclonic Egg Theory & Market Psychology (Buy on Panics, Sell on Euphoria)",
    "잭 슈웨거": "Trend Following, Risk-to-Reward Asymmetry & Systematic Drawdown Control",
    "워런 버핏": "Durable Economic Moat, High Capital Return (ROE ≥ 15%) & Owner Earnings",
    "필립 피셔": "Scuttlebutt Research, 15 Growth Points & Long-term Exceptional Compounding",
    "찰리 멍거": "Multi-Disciplinary Mental Models, Inversion Thinking & High-Quality Business Moats",
    "피터 린치": "Everyday Consumer Insights, 6 Company Categories & PEG Ratio < 1.0",
    "애스워스 다모다란": "Intrinsic DCF Valuation, Free Cash Flow to Firm (FCFF) & Story-to-Numbers Bridge",
    "존 템플턴": "Global Bargain Hunting & Point of Maximum Pessimism Contrarian Value",
    "마이클 버리": "Forensic Financial Accounting, Asymmetric Tail Risk & Deep Value Catalyst",
}

STYLE_EN_MAP = {
    "가치/안전마진": "Value / Safety Margin",
    "성장/GARP": "Growth / GARP",
    "퀄리티/자본수익률": "Quality / Capital Efficiency",
    "퀀트/자본수익률": "Quant / Capital Efficiency",
    "DCF/가치평가": "DCF / Valuation",
    "매크로/유동성": "Macro / Liquidity",
    "모멘텀/추세추종": "Momentum / Trend",
    "포렌식/회계검증": "Forensic / Accounting",
}

VERDICT_EN_MAP = {"매수": "BUY", "보유": "HOLD", "관망": "WATCH", "매도": "SELL"}


def translate_review_flag_en(flag: str) -> str:
    """국문 검토 플래그를 표준 영문 문구로 변환."""
    if not flag:
        return ""
    # 1. 분산율 초과
    m_disp = re.search(r"분산이\s*([\d\.]+)%로\s*기준\s*([\d\.]+)%\s*초과", flag)
    if m_disp:
        disp_val, th_val = m_disp.group(1), m_disp.group(2)
        return f"Valuation dispersion is {disp_val}%, exceeding the {th_val}% threshold (High variance across personas)"

    # 2. 데이터 지표 부족으로 인한 조건부 관망
    m_data_gap = re.search(r"데이터\s*지표\s*부족으로\s*인한\s*조건부\s*(?:관망|WATCH):\s*(\d+)[인명]?", flag)
    if m_data_gap:
        return f"Conditional WATCH due to insufficient data indicators: {m_data_gap.group(1)} persona(s)"

    # 3. 유효 페르소나 패널 완전성
    m_valid = re.search(r"유효\s*페르소나\s*(\d+)/(\d+)", flag)
    if m_valid:
        return f"Valid personas {m_valid.group(1)}/{m_valid.group(2)}; consensus defaulted to WATCH due to panel completeness criteria"

    # 4. 적정가 추정에 사용한 페르소나 수
    m_est_cnt = re.search(r"적정가\s*추정에\s*사용한\s*페르소나\s*(\d+)/(\d+)", flag)
    if m_est_cnt:
        return f"Personas used for fair value estimate: {m_est_cnt.group(1)}/{m_est_cnt.group(2)}"

    # 5. 유효 적정가 구간 수 미달
    m_valid_interval = re.search(r"유효\s*적정가\s*구간\s*(\d+)/(\d+)", flag)
    if m_valid_interval:
        return f"Valid fair value intervals: {m_valid_interval.group(1)}/{m_valid_interval.group(2)}; single fair value requires minimum threshold"

    # 6. 중복 페르소나 제외
    if "중복 페르소나" in flag:
        names = flag.split(":", 1)[1].strip() if ":" in flag else ""
        for ko_name, en_name in GURU_EN_NAME_MAP.items():
            names = names.replace(ko_name, en_name).replace(ko_name.replace(" ", "-"), en_name)
        return f"Excluded duplicate persona responses: {names}".strip(": ")

    if "추정 인원 부족" in flag or "유효 적정가" in flag:
        return "Insufficient valid fair value estimates; band estimation withheld"
    if "단일 적정가 신뢰도 주의" in flag:
        return "Single fair value confidence warning due to missing persona responses"
    if "안전마진 가격 후보가 적정가보다 높아" in flag:
        return "Margin of safety price candidate exceeded fair value; adjusted to band lower bound (Q1)"
    if "목표 매도가 후보가 적정가보다 낮아" in flag:
        return "Target exit price candidate fell below fair value; adjusted to band upper bound (Q3)"
    if "safety_entry_price가 fair_value_price보다" in flag:
        return "Safety entry price exceeds fair value price"
    if "fair_value_price가 optimistic_target_price보다" in flag:
        return "Fair value price exceeds target price"
    if "target_price_band 범위를 벗어났습니다" in flag:
        return "Fair value price is outside target price band"

    # 7. 기본 정리 및 한글 잔여물 안전 제거
    cleaned = clean_korean_from_en(flag)
    if re.search(r"[\uac00-\ud7a3]", cleaned):
        cleaned = re.sub(r"[\uac00-\ud7a3]+", "", cleaned).strip(" :;·-")
        if not cleaned:
            return "Review item noted in persona deliberation"
    return cleaned


def clean_korean_from_en(text: str) -> str:
    """영문 텍스트 내에 섞인 한글 투자의견 및 한글 단어들을 영문 표준 용어로 치환 및 정제."""
    if not text:
        return ""
    s = text
    # 괄호 안 한글 투자의견: (관망) -> (WATCH), (매수) -> (BUY), (보유) -> (HOLD), (매도) -> (SELL)
    s = re.sub(r"\(\s*관망\s*\)", "(WATCH)", s)
    s = re.sub(r"\(\s*매수\s*\)", "(BUY)", s)
    s = re.sub(r"\(\s*보유\s*\)", "(HOLD)", s)
    s = re.sub(r"\(\s*매도\s*\)", "(SELL)", s)
    # 단독 한글 투자의견 치환
    s = re.sub(r"관망", "WATCH", s)
    s = re.sub(r"매수", "BUY", s)
    s = re.sub(r"보유", "HOLD", s)
    s = re.sub(r"매도", "SELL", s)
    # 유효 의견 및 단위 치환
    s = re.sub(r"유효\s*의견\s*(\d+)/(\d+)", r"Valid Votes \1/\2", s)
    s = re.sub(r"유효\s*의견", "Valid Votes", s)
    s = re.sub(r"(\d+)\s*[인명]", r"\1 persona(s)", s)
    # 금액/단위 치환
    s = re.sub(r"조\s*원", "T KRW", s)
    s = re.sub(r"억\s*원", "00M KRW", s)
    s = re.sub(r"(\d+)\s*원", r"KRW \1", s)
    return s.strip()


def _format_price(value: float | None, currency: str) -> str:
    if value is None:
        return "산출 보류"
    if currency.upper() == "USD":
        return f"${value:,.2f}"
    return f"{currency} {value:,.0f}"


def _fallback_narrative(
    consensus: ReportConsensus,
    summaries: GuruSummaryDoc,
) -> dict[str, Any]:
    valid_summaries = [s for s in summaries.summaries if s.parse_mode != "fallback"]
    favorable = [s for s in valid_summaries if s.verdict in {"매수", "보유"}]
    unfavorable = [s for s in valid_summaries if s.verdict in {"매도", "관망"}]
    verdict_en_map = {"매수": "BUY", "보유": "HOLD", "관망": "WATCH", "매도": "SELL"}
    verdict_en = verdict_en_map.get(consensus.verdict, "WATCH")
    return {
        "conclusion": (
            f"고정 집계 규칙상 종합 의견은 {consensus.verdict}입니다. "
            f"유효 표결은 {consensus.valid_vote_count}/{EXPECTED_PERSONA_COUNT}명입니다."
        ),
        "hot_topics": ["의견 일치도", "적정가 분산", "재무·성장 근거"],
        "bull_points": [
            argument for summary in favorable for argument in summary.core_arguments[:1]
        ][:5],
        "bear_points": [
            argument for summary in unfavorable for argument in summary.core_arguments[:1]
        ][:5],
        "key_drivers": list(
            dict.fromkeys(
                condition
                for summary in summaries.summaries
                for condition in summary.trigger_conditions
            )
        )[:5],
        "conclusion_en": (
            f"Based on deterministic aggregation rules, overall consensus is {verdict_en} "
            f"with {consensus.valid_vote_count}/{EXPECTED_PERSONA_COUNT} valid guru votes."
        ),
        "hot_topics_en": ["Consensus Agreement", "Valuation Dispersion", "Fundamental Growth"],
        "bull_points_en": ["Stable competitive moat and pricing power", "Consistent operating profitability"],
        "bear_points_en": ["Valuation multiple compression risk", "Macroeconomic volatility"],
        "key_drivers_en": ["Revenue growth rate", "Free cash flow expansion", "Operating margin durability"],
    }


async def build_master_report(
    ai: AiGatewayClient,
    datapack: StockDataPack,
    summaries: GuruSummaryDoc,
    model_override: str | None = None,
    temperature_override: float | None = None,
) -> FinalMasterReport:
    """Generate narrative only; final verdict and prices are computed locally."""
    consensus = aggregate_report_consensus(summaries.summaries)
    currency = datapack.currency or "USD"
    target_band = (
        format_price_range(
            consensus.band_low,
            consensus.band_high,
            symbol="$" if currency.upper() == "USD" else f"{currency} ",
        )
        if consensus.band_low is not None and consensus.band_high is not None
        else None
    )
    safety_entry_text = (
        f"{_format_price(consensus.safety_entry, currency)} 이하"
        if consensus.safety_entry is not None
        else None
    )
    target_sell_text = (
        _format_price(consensus.target_sell, currency)
        if consensus.target_sell is not None
        else None
    )

    prompt = f"""너는 투자 리서치 보고서의 근거 서술 담당자다.
최종 의견과 가격은 별도 규칙으로 계산되어 확정됐다. 이를 변경하거나 재계산하지 마라.

[확정된 결정 데이터]
- 최종 의견: {consensus.verdict}
- 표결: {consensus.vote_summary}
- 적정가 중앙값: {_format_price(consensus.fair_value, currency)}
- 중앙 50% 구간: {target_band or '산출 보류'}
- 안전마진 가격: {safety_entry_text or '산출 보류'}
- 목표 가격 상단 참고값: {target_sell_text or '산출 보류'}
- 유효 페르소나: {consensus.valid_vote_count}/{EXPECTED_PERSONA_COUNT}
- 가격 의견 분산: {f'{consensus.dispersion_pct:.1f}%' if consensus.dispersion_pct is not None else '계산 불가'}

아래 데이터와 의견에서 보고서 설명에 필요한 근거만 추려라.
새 투자의견, 적정가, 목표가, 안전마진 가격을 만들지 마라.
가격 의견 분산이 높거나 분석 누락이 있으면 그 불확실성을 명확히 설명하라.

[데이터팩]
{datapack.raw_markdown}

[13인 요약]
{summaries.raw_markdown}

[출력 형식]
JSON 객체 하나만 출력한다. 필드는 다음과 같다:
- 한국어 필드: hot_topics(문자열 배열), bull_points(문자열 배열), bear_points(문자열 배열), key_drivers(문자열 배열)
- 영문 필드(i18n): conclusion_en(영문 요약 1~2문장), hot_topics_en(영문 문자열 배열), bull_points_en(영문 문자열 배열), bear_points_en(영문 문자열 배열), key_drivers_en(영문 문자열 배열)

[영문 필드 작성 필수 규칙]
- 영문 필드(conclusion_en, hot_topics_en, bull_points_en, bear_points_en, key_drivers_en)는 반드시 100% 영문(English)으로만 작성해야 한다.
- '관망', '매수', '보유', '매도', '(관망)', '조원', '억원' 등 어떠한 한국어 단어도 영문 필드에 절대 포함하지 마라.
- 투자의견은 BUY, HOLD, WATCH, SELL 또는 Neutral, Bullish, Bearish 등 영문 표준 용어만 사용하라.
각 배열은 최대 5개이며, 입력에 없는 사실을 추가하지 않는다.
마크다운 취소선(~~)을 쓰지 마라. 범위·근사 표기는 물결표(~) 대신 '–' 또는 '부터/까지'를 써라(예: Q1–Q3, 140조–150조원).
"""

    narrative_payload: dict[str, Any] | None = None
    parse_mode: Literal["json", "regex"] = "json"
    try:
        response = await ai.chat(
            prompt,
            max_tokens=5000,
            model_override=model_override,
            pin_model=bool(model_override),
            temperature_override=temperature_override,
        )
        parsed = extract_json_object(response)
        if isinstance(parsed, dict):
            narrative_payload = parsed
    except Exception as error:
        logger.warning(
            "[%s] 보고서 서술 AI 생성 실패; 결정값 기반 폴백 사용: %s",
            datapack.ticker,
            error,
        )

    if narrative_payload is None:
        parse_mode = "regex"
        narrative_payload = _fallback_narrative(consensus, summaries)

    conclusion = (
        f"고정 규칙상 {consensus.valid_vote_count}/{EXPECTED_PERSONA_COUNT}개의 유효 표결로 "
        f"종합 의견은 {consensus.verdict}입니다. 적정가 중앙값은 "
        f"{_format_price(consensus.fair_value, currency)}이며, 가격 의견 분산은 "
        f"{f'{consensus.dispersion_pct:.1f}%' if consensus.dispersion_pct is not None else '계산 불가'}입니다."
    )
    hot_topics = as_str_list(narrative_payload.get("hot_topics"), limit=5)
    bull_points = as_str_list(narrative_payload.get("bull_points"), limit=5)
    bear_points = as_str_list(narrative_payload.get("bear_points"), limit=5)
    key_drivers = as_str_list(narrative_payload.get("key_drivers"), limit=5)
    if not conclusion:
        conclusion = f"고정 집계 규칙상 종합 의견은 {consensus.verdict}입니다."
    if not hot_topics:
        hot_topics = ["의견 일치도", "적정가 분산", "재무·성장 근거"]

    # 영문 i18n 필드 파싱 및 한글 정제
    verdict_en = VERDICT_EN_MAP.get(consensus.verdict, "WATCH")
    raw_conclusion_en = str(narrative_payload.get("conclusion_en") or "").strip()
    conclusion_en = clean_korean_from_en(raw_conclusion_en)
    if not conclusion_en:
        conclusion_en = (
            f"Based on deterministic aggregation rules, overall consensus is {verdict_en} "
            f"with {consensus.valid_vote_count}/{EXPECTED_PERSONA_COUNT} valid guru votes. "
            f"Median fair value is {_format_price(consensus.fair_value, currency)}."
        )
    hot_topics_en = [
        clean_korean_from_en(x)
        for x in (as_str_list(narrative_payload.get("hot_topics_en"), limit=5) or [
            "Consensus Agreement",
            "Valuation Dispersion",
            "Fundamental Growth",
        ])
        if clean_korean_from_en(x)
    ]
    bull_points_en = [
        clean_korean_from_en(x)
        for x in as_str_list(narrative_payload.get("bull_points_en"), limit=5)
        if clean_korean_from_en(x)
    ]
    bear_points_en = [
        clean_korean_from_en(x)
        for x in as_str_list(narrative_payload.get("bear_points_en"), limit=5)
        if clean_korean_from_en(x)
    ]
    key_drivers_en = [
        clean_korean_from_en(x)
        for x in as_str_list(narrative_payload.get("key_drivers_en"), limit=5)
        if clean_korean_from_en(x)
    ]

    # 강세/약세 논거에 페르소나 출처 매핑
    def _map_personas_to_points(points: list[str], target_verdicts: set[str]) -> list[dict]:
        mapped = []
        cands = [s for s in summaries.summaries if s.parse_mode != "fallback" and s.verdict in target_verdicts]
        for pt in points:
            matched: list[str] = []
            tokens = [w for w in pt.replace(",", " ").split() if len(w) >= 2]
            for s in cands:
                for arg in s.core_arguments:
                    if any(t in arg for t in tokens[:4]):
                        matched.append(s.persona)
                        break
            if not matched and cands:
                matched = [cands[0].persona]
            mapped.append({"text": pt, "personas": list(dict.fromkeys(matched))[:3]})
        return mapped

    bull_arguments = _map_personas_to_points(bull_points, {"매수", "보유"})
    bear_arguments = _map_personas_to_points(bear_points, {"매도", "관망"})

    valuation_json = {
        "fair_value_price": round(consensus.fair_value, 2)
        if consensus.fair_value is not None
        else None,
        "target_price_band": target_band,
        "safety_entry_price": safety_entry_text,
        "optimistic_target_price": target_sell_text,
        "dispersion_pct": round(consensus.dispersion_pct, 2)
        if consensus.dispersion_pct is not None
        else None,
        "price_estimate_count": consensus.price_estimate_count,
        "method": (
            "13인 적정가 구간 중점값의 중앙값; 밴드는 Q1–Q3; "
            "분산율은 사분위 범위(IQR) 기반"
        ),
    }
    fair_value_header = (
        _format_price(consensus.fair_value, currency)
        if consensus.fair_value is not None
        else "단일 적정가 보류"
    )
    safety_header = safety_entry_text or "산출 보류"
    target_header = target_sell_text or "산출 보류"
    band_header = target_band or "구간 산출 보류"
    dispersion_text = (
        f"{consensus.dispersion_pct:.1f}%"
        if consensus.dispersion_pct is not None
        else "계산 불가"
    )

    # 스타일 버킷 포맷팅
    style_desc_items = []
    for bucket_name, b_counts in (consensus.style_breakdown or {}).items():
        sub_items = [f"{v}{c}" for v, c in b_counts.items() if c > 0]
        if sub_items:
            style_desc_items.append(f"{bucket_name}({', '.join(sub_items)})")
    style_summary_text = " · ".join(style_desc_items) if style_desc_items else "소계 산출 중"

    mean_score_str = (
        f"평균 {consensus.mean_score:.2f}점"
        if consensus.mean_score is not None
        else "평균 산출 보류"
    )
    score_std_str = (
        f"(표준편차: {consensus.score_std:.2f})"
        if consensus.score_std is not None
        else ""
    )
    net_buy_str = (
        f"{consensus.net_buy_ratio:+.1%}"
        if consensus.net_buy_ratio is not None
        else "N/A"
    )

    lines = [
        f"# {datapack.ticker} 최종 투자 보고서",
        f"> **날짜**: {datapack.date} | **종합 의견**: **{consensus.verdict}** | **표결**: {consensus.vote_summary}",
        f"> **현재가**: {_format_price(datapack.current_price, currency)} | **13인 적정가 중앙값**: {fair_value_header} (중앙 50% 구간: {band_header})",
        f"> **투자 실행 참고**: [안전마진 가격] {safety_header} | [목표 가격 상단 참고] {target_header}",
        "",
        "## 1. 종합 결론 및 집계 근거",
        f"- **종합 판정**: {consensus.verdict}",
        f"- **근거 요약**: {conclusion}",
        f"- **연속 점수 통계**: {mean_score_str} {score_std_str} [0=매수 ~ 3=매도], 순매수 비율(Net Buy Ratio): {net_buy_str}".replace("  ", " "),
        f"- **스타일 소계**: {style_summary_text}",
        f"- **판정 규칙**: 13인 중 최소 {MIN_VALID_PERSONAS}개의 유효 의견이 필요하며, 유효 의견의 60% 이상이 같은 판정일 때 해당 판정을 채택합니다. 그 외에는 관망입니다.",
        f"- **가격 집계**: 유효 가격 구간 {consensus.price_estimate_count}/{EXPECTED_PERSONA_COUNT}개의 중점값 중앙값. 적정가 구간은 중앙 50%(Q1–Q3)입니다.",
        f"- **가격 의견 분산**: {dispersion_text} (중앙 50% Q1~Q3 구간 폭 ÷ 중앙 적정가; IQR 분산율)",
    ]
    if consensus.data_gap_watch_count > 0:
        lines.append(f"- **조건부 관망**: {consensus.data_gap_watch_count}인이 추가 재무·사업 지표 확인 시까지 판단을 보류했습니다.")
    if consensus.review_flags:
        lines.append("- **검토 필요**: " + "; ".join(consensus.review_flags))
    lines.extend(["", "## 2. 강세론 핵심 (Bull Case)"])
    if bull_arguments:
        for b_arg in bull_arguments:
            p_str = f" *(출처: {', '.join(b_arg['personas'])})*" if b_arg.get("personas") else ""
            lines.append(f"- {b_arg['text']}{p_str}")
    else:
        lines.append("- 구조화된 강세 논거가 충분히 수집되지 않았습니다.")

    lines.extend(["", "## 3. 약세론 핵심 (Bear Case)"])
    if bear_arguments:
        for b_arg in bear_arguments:
            p_str = f" *(출처: {', '.join(b_arg['personas'])})*" if b_arg.get("personas") else ""
            lines.append(f"- {b_arg['text']}{p_str}")
    else:
        lines.append("- 구조화된 약세 논거가 충분히 수집되지 않았습니다.")

    lines.extend(["", "## 4. 핵심 쟁점 및 가치 드라이버"])
    lines.extend([f"- {topic}" for topic in hot_topics])
    lines.extend([f"- {driver}" for driver in key_drivers])
    lines.extend(["", "## 5. 실전 참고"])
    lines.append(f"- 안전마진 가격 참고: {safety_header}")
    lines.append(f"- 현재가: {_format_price(datapack.current_price, currency)}")
    lines.append(f"- 판정: {consensus.verdict} (표결 supermajority 규칙 적용)")
    lines.extend(
        [
            "",
            "## 6. 13인 요약표",
            "| 인물 | 투자의견 | 확신도 | 적정가 구간 | 핵심 논거 |",
            "|---|---|---:|---|---|",
        ]
    )
    persona_by_key = {summary.persona: summary for summary in summaries.summaries}
    for guru_name, persona_key in GURU_REPORT_ROSTER:
        summary = persona_by_key.get(persona_key)
        if summary is None or summary.parse_mode == "fallback":
            lines.append(f"| {guru_name} | 미응답 | — | — | — |")
            continue
        argument = (summary.core_arguments[0] if summary.core_arguments else "").replace("|", "/")
        target = (summary.target_price_range or "—").replace("|", "/")
        lines.append(
            f"| {guru_name} | {summary.verdict} | {summary.confidence}/10 | {target} | {argument} |"
        )
    lines.extend(["", "*본 보고서는 서적 기반 페르소나 시뮬레이션이며 투자 자문이 아닙니다.*"])
    raw_markdown = "\n".join(lines)

    # ── 영문 마스터 리포트 마크다운 조립 ─────────────────────
    fair_value_header_en = (
        _format_price(consensus.fair_value, currency)
        if consensus.fair_value is not None
        else "Pending"
    )
    safety_header_en = (
        f"Below {_format_price(consensus.safety_entry, currency)}"
        if consensus.safety_entry is not None
        else "Pending"
    )
    target_header_en = (
        _format_price(consensus.target_sell, currency)
        if consensus.target_sell is not None
        else "Pending"
    )
    band_header_en = target_band or "Pending"
    dispersion_text_en = (
        f"{consensus.dispersion_pct:.1f}%"
        if consensus.dispersion_pct is not None
        else "N/A"
    )
    vote_summary_en = clean_korean_from_en(consensus.vote_summary)
    company_name_en = datapack.company_name_en or datapack.ticker

    style_desc_items_en = []
    for bucket_name, b_counts in (consensus.style_breakdown or {}).items():
        b_en = STYLE_EN_MAP.get(bucket_name, bucket_name)
        sub_items = [f"{VERDICT_EN_MAP.get(v, v)} {c}" for v, c in b_counts.items() if c > 0]
        if sub_items:
            style_desc_items_en.append(f"{b_en} ({', '.join(sub_items)})")
    style_summary_text_en = " · ".join(style_desc_items_en) if style_desc_items_en else "Calculating"

    mean_score_str_en = (
        f"Mean {consensus.mean_score:.2f} pts"
        if consensus.mean_score is not None
        else "Score Pending"
    )
    score_std_str_en = (
        f"(Std Dev: {consensus.score_std:.2f})"
        if consensus.score_std is not None
        else ""
    )

    lines_en = [
        f"# {datapack.ticker} ({company_name_en}) Final Investment Master Report",
        f"> **Date**: {datapack.date} | **Consensus Verdict**: **{verdict_en}** | **Votes**: {vote_summary_en}",
        f"> **Current Price**: {_format_price(datapack.current_price, currency)} | **13-Guru Fair Value Median**: {fair_value_header_en} (Fair Value Band Q1–Q3: {band_header_en})",
        f"> **Execution Reference**: [Margin of Safety Entry] {safety_header_en} | [Target Price Upper Reference] {target_header_en}",
        "",
        "## 1. Executive Summary & Consensus Rationale",
        f"- **Consensus Verdict**: {verdict_en}",
        f"- **Executive Rationale**: {conclusion_en}",
        f"- **Continuous Score Stats**: {mean_score_str_en} {score_std_str_en} [0=BUY ~ 3=SELL], Net Buy Ratio: {net_buy_str}".replace("  ", " "),
        f"- **Style Breakdown**: {style_summary_text_en}",
        f"- **Consensus Rule**: Requires at least {MIN_VALID_PERSONAS} valid votes out of 13. A verdict requires at least 60% agreement; otherwise classified as WATCH.",
        f"- **Valuation Aggregation**: Median of midpoints from {consensus.price_estimate_count}/{EXPECTED_PERSONA_COUNT} valid price ranges. Fair value band represents the interquartile range (Q1–Q3).",
        f"- **Valuation Dispersion**: {dispersion_text_en} (Interquartile Range Q1–Q3 width ÷ Median Fair Value; IQR dispersion)",
    ]
    if consensus.data_gap_watch_count > 0:
        lines_en.append(f"- **Conditional Watch**: {consensus.data_gap_watch_count} gurus reserved judgment pending additional financial disclosures.")
    if consensus.review_flags:
        translated_flags = [translate_review_flag_en(f) for f in consensus.review_flags if translate_review_flag_en(f)]
        if translated_flags:
            lines_en.append("- **Review Items**: " + "; ".join(translated_flags))

    lines_en.extend(["", "## 2. Key Bullish Catalysts (Bull Case)"])
    if bull_points_en:
        for b_pt in bull_points_en:
            lines_en.append(f"- {clean_korean_from_en(b_pt)}")
    else:
        lines_en.append("- Insufficient structured bullish arguments collected.")

    lines_en.extend(["", "## 3. Key Bearish Risks (Bear Case)"])
    if bear_points_en:
        for b_pt in bear_points_en:
            lines_en.append(f"- {clean_korean_from_en(b_pt)}")
    else:
        lines_en.append("- Insufficient structured bearish arguments collected.")

    lines_en.extend(["", "## 4. Core Analytical Debates & Value Drivers"])
    lines_en.extend([f"- {clean_korean_from_en(topic)}" for topic in hot_topics_en])
    lines_en.extend([f"- {clean_korean_from_en(driver)}" for driver in key_drivers_en])

    lines_en.extend(["", "## 5. Practical Investment Reference"])
    lines_en.append(f"- Margin of Safety Reference: {safety_header_en}")
    lines_en.append(f"- Current Price: {_format_price(datapack.current_price, currency)}")
    lines_en.append(f"- Verdict: {verdict_en} (Supermajority vote consensus applied)")

    lines_en.extend(
        [
            "",
            "## 6. 13-Guru Consensus Summary Table",
            "| Guru | Verdict | Confidence | Fair Value Range | Core Thesis |",
            "|---|---|---:|---|---|",
        ]
    )
    for guru_name, persona_key in GURU_REPORT_ROSTER:
        summary = persona_by_key.get(persona_key)
        guru_en = GURU_EN_NAME_MAP.get(guru_name, guru_name)
        if summary is None or summary.parse_mode == "fallback":
            lines_en.append(f"| {guru_en} | NO RESPONSE | — | — | — |")
            continue
        v_en = VERDICT_EN_MAP.get(summary.verdict, summary.verdict)
        target = clean_korean_from_en((summary.target_price_range or "—").replace("|", "/"))
        if (datapack.ticker.isdigit() or len(datapack.ticker) == 6) and "$" in target:
            target = target.replace("$", "KRW ")

        core_focus = GURU_EN_THESIS_MAP.get(guru_name, "Fundamental Valuation")
        if v_en == "BUY":
            thesis_en = f"Meets criteria: {core_focus}"
        elif v_en == "HOLD":
            thesis_en = f"Balanced on criteria: {core_focus}"
        elif v_en == "WATCH":
            thesis_en = f"Awaiting clearer signals on: {core_focus}"
        elif v_en == "SELL":
            thesis_en = f"Fails conservative criteria: {core_focus}"
        else:
            thesis_en = core_focus

        lines_en.append(
            f"| {guru_en} | {v_en} | {summary.confidence}/10 | {target} | {thesis_en} |"
        )
    lines_en.extend(["", "*This report is generated via simulated book-based AI personas and does not constitute financial advice.*"])
    raw_markdown_en = "\n".join(lines_en)

    bull_str = "; ".join(bull_points) or "강세 논거 수집 부족"
    bear_str = "; ".join(bear_points) or "약세 논거 수집 부족"
    return FinalMasterReport(
        ticker=datapack.ticker,
        date=datapack.date,
        overall_verdict=consensus.verdict,  # type: ignore[arg-type]
        overall_score=consensus.score,
        vote_summary=consensus.vote_summary,
        fair_value_price=valuation_json["fair_value_price"],
        target_price_band=target_band,
        safety_entry_price=safety_entry_text,
        optimistic_target_price=target_sell_text,
        valuation_review_flags=consensus.review_flags,
        bull_case=bull_str[:200],
        bear_case=bear_str[:200],
        value_drivers=key_drivers,
        action_guide={
            "verdict_rule": (
                f"13인 중 60% supermajority; 유효 의견 {MIN_VALID_PERSONAS}개 미만이면 관망"
            ),
            "fair_value_method": valuation_json["method"],
            "safety_entry_price": safety_entry_text,
            "target_price_band": target_band,
        },
        conclusion=conclusion,
        hot_topics=hot_topics,
        bull_points=bull_points,
        bear_points=bear_points,
        bull_arguments=bull_arguments,
        bear_arguments=bear_arguments,
        key_drivers=key_drivers,
        company_name_en=datapack.company_name_en or datapack.ticker,
        conclusion_en=conclusion_en,
        hot_topics_en=hot_topics_en,
        bull_points_en=bull_points_en,
        bear_points_en=bear_points_en,
        key_drivers_en=key_drivers_en,
        final_report_en=raw_markdown_en,
        band_low=consensus.band_low,
        band_high=consensus.band_high,
        safety_entry_value=consensus.safety_entry,
        target_sell_value=consensus.target_sell,
        valuation_dispersion_pct=consensus.dispersion_pct,
        valuation_estimate_count=consensus.price_estimate_count,
        mean_score=consensus.mean_score,
        score_std=consensus.score_std,
        net_buy_ratio=consensus.net_buy_ratio,
        style_breakdown=consensus.style_breakdown,
        data_gap_watch_count=consensus.data_gap_watch_count,
        model=model_override,
        parse_mode=parse_mode,
        raw_markdown=raw_markdown,
    )
