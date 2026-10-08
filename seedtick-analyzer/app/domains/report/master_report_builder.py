"""Build the final report around deterministic vote and price aggregation."""

from __future__ import annotations

import json
import logging
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
    GuruDiscussionDoc,
    GuruSummaryDoc,
    StockDataPack,
)
from app.domains.report.structuring import as_str_list, extract_json_object, format_price_range

logger = logging.getLogger("master_report_builder")


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
    }


async def build_master_report(
    ai: AiGatewayClient,
    datapack: StockDataPack,
    summaries: GuruSummaryDoc,
    discussion: GuruDiscussionDoc,
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
JSON 객체 하나만 출력한다. 필드는 hot_topics(문자열 배열),
bull_points(문자열 배열), bear_points(문자열 배열), key_drivers(문자열 배열)다.
각 배열은 최대 5개이며, 입력에 없는 사실을 추가하지 않는다.
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
            "전체 추정 범위가 중앙값 대비 20% 초과면 단일가 보류"
        ),
    }
    json_block = json.dumps(
        {"valuation_consensus": valuation_json}, ensure_ascii=False, indent=2
    )

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

    lines = [
        f"# {datapack.ticker} 최종 투자 보고서",
        f"> **날짜**: {datapack.date} | **종합 의견**: **{consensus.verdict}** | **표결**: {consensus.vote_summary}",
        f"> **현재가**: {_format_price(datapack.current_price, currency)} | **13인 적정가 중앙값**: {fair_value_header} (중앙 50% 구간: {band_header})",
        f"> **투자 실행 참고**: [안전마진 가격] {safety_header} | [목표 가격 상단 참고] {target_header}",
        "",
        "```json",
        json_block,
        "```",
        "",
        "## 1. 종합 결론 및 집계 근거",
        f"- **종합 판정**: {consensus.verdict}",
        f"- **근거 요약**: {conclusion}",
        f"- **판정 규칙**: 13인 중 최소 {MIN_VALID_PERSONAS}개의 유효 의견이 필요하며, 유효 의견의 60% 이상이 같은 판정일 때 해당 판정을 채택합니다. 그 외에는 관망입니다.",
        f"- **가격 집계**: 유효 가격 구간 {consensus.price_estimate_count}/{EXPECTED_PERSONA_COUNT}개의 중점값 중앙값. 적정가 구간은 중앙 50%(Q1–Q3)입니다.",
        f"- **가격 의견 분산**: {dispersion_text} (최고~최저 추정 폭 ÷ 중앙 적정가; 20% 초과 시 단일가 보류)",
    ]
    if consensus.review_flags:
        lines.append("- **검토 필요**: " + "; ".join(consensus.review_flags))
    lines.extend(["", "## 2. 강세론 핵심 (Bull Case)"])
    lines.extend(
        [f"- {point}" for point in bull_points]
        or ["- 구조화된 강세 논거가 충분히 수집되지 않았습니다."]
    )
    lines.extend(["", "## 3. 약세론 핵심 (Bear Case)"])
    lines.extend(
        [f"- {point}" for point in bear_points]
        or ["- 구조화된 약세 논거가 충분히 수집되지 않았습니다."]
    )
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
        key_drivers=key_drivers,
        band_low=consensus.band_low,
        band_high=consensus.band_high,
        safety_entry_value=consensus.safety_entry,
        target_sell_value=consensus.target_sell,
        valuation_dispersion_pct=consensus.dispersion_pct,
        valuation_estimate_count=consensus.price_estimate_count,
        parse_mode=parse_mode,
        raw_markdown=raw_markdown,
        discussion=discussion.raw_markdown,
    )
