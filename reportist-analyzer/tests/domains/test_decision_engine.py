import pytest
from app.config.constants import GURU_REPORT_PERSONA_KEYS
from app.domains.report.decision_engine import (
    _quantile,
    aggregate_report_consensus,
    HIGH_DISPERSION_ALERT_PCT,
    MIN_PRICE_ESTIMATES,
)
from app.domains.report.models import PersonaSummaryBlock


def test_quantile_linear_interpolation():
    values = [10.0, 20.0, 30.0, 40.0]
    assert _quantile(values, 0.0) == 10.0
    assert _quantile(values, 0.5) == 25.0
    assert _quantile(values, 1.0) == 40.0


def test_aggregate_report_consensus_preserves_fair_value_with_outliers():
    """극단적 이상치가 존재해도 중앙값과 IQR 밴드, 안전마진/목표가가 null로 증발하지 않고 보존되는지 검증."""
    # 13명의 페르소나 모의 (중간 11명은 100~130 사이, 2명은 30달러와 350달러의 극단적 이상치)
    midpoint_targets = [
        (25.0, 35.0),    # mid: 30.0 (극단적 저평가/약세)
        (90.0, 110.0),   # mid: 100.0
        (95.0, 115.0),   # mid: 105.0
        (95.0, 115.0),   # mid: 105.0
        (100.0, 120.0),  # mid: 110.0
        (100.0, 120.0),  # mid: 110.0
        (105.0, 125.0),  # mid: 115.0 (중앙값 근처)
        (110.0, 130.0),  # mid: 120.0
        (110.0, 130.0),  # mid: 120.0
        (115.0, 135.0),  # mid: 125.0
        (120.0, 140.0),  # mid: 130.0
        (120.0, 140.0),  # mid: 130.0
        (300.0, 400.0),  # mid: 350.0 (극단적 낙관/고평가)
    ]

    summaries = [
        PersonaSummaryBlock(
            persona=key,
            verdict="매수",
            confidence=8,
            core_arguments=["해자"],
            target_price_low=low,
            target_price_high=high,
            quote="대표 발언",
            parse_mode="json",
        )
        for key, (low, high) in zip(GURU_REPORT_PERSONA_KEYS, midpoint_targets)
    ]

    consensus = aggregate_report_consensus(summaries)

    # 1. 단일 적정가는 중앙값(115.0)으로 정상 도출되어야 함 (null 보류 금지)
    assert consensus.fair_value is not None
    assert consensus.fair_value == 115.0

    # 2. 밴드 (Q1 ~ Q3)는 중앙 50% 구간으로 정상 산출되어야 함
    assert consensus.band_low is not None
    assert consensus.band_high is not None
    assert consensus.band_low < consensus.fair_value < consensus.band_high

    # 3. 분산율은 (Max-Min)이 아니라 IQR ((band_high - band_low) / median) 기반이어야 함
    expected_iqr = consensus.band_high - consensus.band_low
    expected_dispersion = (expected_iqr / 115.0) * 100.0
    assert pytest.approx(consensus.dispersion_pct, rel=1e-3) == expected_dispersion

    # 4. 안전마진가 및 목표가가 정상 산출되어야 함
    assert consensus.safety_entry is not None
    assert consensus.safety_entry <= consensus.fair_value
    assert consensus.target_sell is not None
    assert consensus.target_sell >= consensus.fair_value
    assert consensus.price_estimate_count == 13


def test_aggregate_report_consensus_insufficient_estimates():
    """유효 가격 구간이 기준치(8개) 미만인 경우 적정가가 보류되는지 검증."""
    summaries = [
        PersonaSummaryBlock(
            persona=key,
            verdict="매수",
            confidence=8,
            core_arguments=["해자"],
            target_price_low=100.0 if idx < 5 else None,
            target_price_high=120.0 if idx < 5 else None,
            quote="대표 발언",
            parse_mode="json",
        )
        for idx, key in enumerate(GURU_REPORT_PERSONA_KEYS)
    ]

    consensus = aggregate_report_consensus(summaries)
    assert consensus.fair_value is None
    assert consensus.safety_entry is None
    assert consensus.target_sell is None
    assert any("유효 적정가 구간 5/13" in flag for flag in consensus.review_flags)


def test_aggregate_report_consensus_supermajority_verdict():
    """60% 이상 집중 시 해당 의견 채택, 미달 시 관망 처리."""
    # 8명 매수 (8/13 ≈ 61.5% > 60%)
    summaries_buy = [
        PersonaSummaryBlock(
            persona=key,
            verdict="매수" if idx < 8 else "관망",
            confidence=7,
            core_arguments=["논거"],
            target_price_low=100.0,
            target_price_high=120.0,
            quote="대표 발언",
            parse_mode="json",
        )
        for idx, key in enumerate(GURU_REPORT_PERSONA_KEYS)
    ]
    consensus_buy = aggregate_report_consensus(summaries_buy)
    assert consensus_buy.verdict == "매수"
    assert consensus_buy.score == 0

    # 7명 매수 (7/13 ≈ 53.8% < 60%) -> 관망
    summaries_watch = [
        PersonaSummaryBlock(
            persona=key,
            verdict="매수" if idx < 7 else "관망",
            confidence=7,
            core_arguments=["논거"],
            target_price_low=100.0,
            target_price_high=120.0,
            quote="대표 발언",
            parse_mode="json",
        )
        for idx, key in enumerate(GURU_REPORT_PERSONA_KEYS)
    ]
    consensus_watch = aggregate_report_consensus(summaries_watch)
    assert consensus_watch.verdict == "관망"
    assert consensus_watch.score == 2
