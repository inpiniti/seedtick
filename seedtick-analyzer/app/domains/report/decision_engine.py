"""Deterministic aggregation of the report panel's structured outputs.

The language model supplies evidence, persona votes, and valuation ranges. This
module applies one fixed policy to those outputs; it never asks a final model
call to invent a new verdict or fair value.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil, isfinite
from statistics import median
from typing import Sequence

from app.config.constants import (
    GURU_REPORT_PERSONA_KEYS,
    GURU_REPORT_ROSTER,
    VERDICT_SCORE_MAP,
)
from app.domains.report.models import PersonaSummaryBlock


EXPECTED_PERSONA_COUNT = len(GURU_REPORT_ROSTER)
MIN_VALID_PERSONAS = ceil(EXPECTED_PERSONA_COUNT * 0.85)
MIN_PRICE_ESTIMATES = ceil(EXPECTED_PERSONA_COUNT * 0.60)
VERDICT_SUPERMAJORITY = 0.60
MAX_PUBLISHABLE_DISPERSION_PCT = 20.0


@dataclass(frozen=True)
class ReportConsensus:
    verdict: str
    score: int
    vote_counts: dict[str, int]
    valid_vote_count: int
    vote_summary: str
    fair_value: float | None
    band_low: float | None
    band_high: float | None
    safety_entry: float | None
    target_sell: float | None
    price_estimate_count: int
    dispersion_pct: float | None
    review_flags: list[str]


def _quantile(values: Sequence[float], probability: float) -> float:
    """Linearly interpolated quantile, independent of NumPy/Pandas versions."""
    ordered = sorted(values)
    if not ordered:
        raise ValueError("quantile requires at least one value")
    if len(ordered) == 1:
        return ordered[0]

    position = (len(ordered) - 1) * probability
    lower_index = int(position)
    upper_index = min(lower_index + 1, len(ordered) - 1)
    fraction = position - lower_index
    return ordered[lower_index] + (ordered[upper_index] - ordered[lower_index]) * fraction


def aggregate_report_consensus(
    summaries: Sequence[PersonaSummaryBlock],
) -> ReportConsensus:
    """Apply the same vote and valuation rules to every report run.

    Verdicts require an 85% complete panel and a 60% supermajority. If the panel
    does not meet that bar, the result is WATCH. Fair value is the median of the
    persona range midpoints; its displayed band is the central 50% (Q1–Q3).
    A single fair-value point is withheld when the full estimate range is wider
    than 20% of its median. This catches separated opinion clusters that a
    central-only range could hide. No previous report is used as an anchor.
    """
    by_persona: dict[str, PersonaSummaryBlock] = {}
    duplicate_personas: set[str] = set()
    active_keys = set(GURU_REPORT_PERSONA_KEYS)
    for summary in summaries:
        if summary.persona not in active_keys:
            continue
        if summary.persona in by_persona:
            duplicate_personas.add(summary.persona)
            continue
        by_persona[summary.persona] = summary

    # Duplicate records make that persona ambiguous; do not arbitrarily pick
    # whichever response happened to arrive first.
    for persona in duplicate_personas:
        by_persona.pop(persona, None)

    usable = [
        by_persona[key]
        for key in GURU_REPORT_PERSONA_KEYS
        if key in by_persona and by_persona[key].parse_mode != "fallback"
    ]
    vote_counts = {verdict: 0 for verdict in VERDICT_SCORE_MAP}
    for summary in usable:
        if summary.verdict in vote_counts:
            vote_counts[summary.verdict] += 1

    valid_vote_count = sum(vote_counts.values())
    top_count = max(vote_counts.values(), default=0)
    top_verdicts = [verdict for verdict, count in vote_counts.items() if count == top_count and count > 0]
    required_votes = ceil(valid_vote_count * VERDICT_SUPERMAJORITY)

    if valid_vote_count < MIN_VALID_PERSONAS or len(top_verdicts) != 1 or top_count < required_votes:
        verdict = "관망"
    else:
        verdict = top_verdicts[0]

    vote_summary = (
        f"매수 {vote_counts['매수']} · 보유 {vote_counts['보유']} · "
        f"관망 {vote_counts['관망']} · 매도 {vote_counts['매도']}"
    )
    if valid_vote_count != EXPECTED_PERSONA_COUNT:
        vote_summary += f" · 유효 의견 {valid_vote_count}/{EXPECTED_PERSONA_COUNT}"

    review_flags: list[str] = []
    if valid_vote_count < EXPECTED_PERSONA_COUNT:
        review_flags.append(
            f"유효 페르소나 {valid_vote_count}/{EXPECTED_PERSONA_COUNT}; "
            "패널 완전성 기준 미달 시 종합 의견은 관망 처리"
        )
    if duplicate_personas:
        review_flags.append(
            "중복 페르소나 응답 제외: " + ", ".join(sorted(duplicate_personas))
        )

    intervals: list[tuple[float, float, float]] = []
    for summary in usable:
        low = summary.target_price_low
        high = summary.target_price_high
        if (
            low is None
            or high is None
            or not isfinite(low)
            or not isfinite(high)
            or low <= 0
            or high <= 0
        ):
            continue
        lower, upper = sorted((float(low), float(high)))
        intervals.append((lower, upper, (lower + upper) / 2.0))

    fair_value: float | None = None
    band_low: float | None = None
    band_high: float | None = None
    safety_entry: float | None = None
    target_sell: float | None = None
    dispersion_pct: float | None = None

    if len(intervals) < MIN_PRICE_ESTIMATES:
        review_flags.append(
            f"유효 적정가 구간 {len(intervals)}/{EXPECTED_PERSONA_COUNT}; "
            f"단일 적정가는 {MIN_PRICE_ESTIMATES}개 이상 필요"
        )
    else:
        midpoints = [interval[2] for interval in intervals]
        median_value = float(median(midpoints))
        band_low = _quantile(midpoints, 0.25)
        band_high = _quantile(midpoints, 0.75)
        full_range_low = min(midpoints)
        full_range_high = max(midpoints)
        dispersion_pct = ((full_range_high - full_range_low) / median_value) * 100.0

        if len(intervals) < EXPECTED_PERSONA_COUNT:
            review_flags.append(
                f"적정가 추정에 사용한 페르소나 {len(intervals)}/{EXPECTED_PERSONA_COUNT}"
            )

        if dispersion_pct > MAX_PUBLISHABLE_DISPERSION_PCT:
            review_flags.append(
                f"개별 적정가 전체 범위의 분산이 {dispersion_pct:.1f}%로 "
                f"기준 {MAX_PUBLISHABLE_DISPERSION_PCT:.0f}% 초과; 단일 적정가 미표시"
            )
        elif valid_vote_count < MIN_VALID_PERSONAS:
            review_flags.append("분석 응답 누락으로 단일 적정가 미표시")
        else:
            fair_value = median_value
            safety_candidate = float(median([interval[0] for interval in intervals]))
            target_candidate = float(median([interval[1] for interval in intervals]))
            if safety_candidate <= fair_value:
                safety_entry = safety_candidate
            else:
                review_flags.append("안전마진 가격 후보가 적정가보다 높아 미표시")
            if target_candidate >= fair_value:
                target_sell = target_candidate
            else:
                review_flags.append("목표 매도가 후보가 적정가보다 낮아 미표시")

    return ReportConsensus(
        verdict=verdict,
        score=VERDICT_SCORE_MAP[verdict],
        vote_counts=vote_counts,
        valid_vote_count=valid_vote_count,
        vote_summary=vote_summary,
        fair_value=fair_value,
        band_low=band_low,
        band_high=band_high,
        safety_entry=safety_entry,
        target_sell=target_sell,
        price_estimate_count=len(intervals),
        dispersion_pct=dispersion_pct,
        review_flags=review_flags,
    )
