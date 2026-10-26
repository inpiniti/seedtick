"""
Unit tests for review flag translations and English report cleanliness.
"""

from __future__ import annotations
import re
import pytest

from app.domains.report.master_report_builder import (
    translate_review_flag_en,
    clean_korean_from_en,
)


def test_translate_review_flags():
    # 1. Dispersion
    flag_disp = "개별 적정가 중앙 50% 분산이 232.3%로 기준 50% 초과 (의견 편차 큼)"
    trans_disp = translate_review_flag_en(flag_disp)
    assert "Valuation dispersion is 232.3%" in trans_disp
    assert not re.search(r"[\uac00-\ud7a3]", trans_disp)

    # 2. Data gap watch (the exact bug in WDC today!)
    flag_data_gap = "데이터 지표 부족으로 인한 조건부 관망: 1인"
    trans_data_gap = translate_review_flag_en(flag_data_gap)
    assert "Conditional WATCH due to insufficient data indicators: 1 persona(s)" in trans_data_gap
    assert not re.search(r"[\uac00-\ud7a3]", trans_data_gap)

    # 3. Valid personas completeness threshold
    flag_valid = "유효 페르소나 12/13; 패널 완전성 기준 미달 시 종합 의견은 관망 처리"
    trans_valid = translate_review_flag_en(flag_valid)
    assert "Valid personas 12/13" in trans_valid
    assert not re.search(r"[\uac00-\ud7a3]", trans_valid)

    # 4. Fair value estimate persona count
    flag_est_cnt = "적정가 추정에 사용한 페르소나 12/13"
    trans_est_cnt = translate_review_flag_en(flag_est_cnt)
    assert "Personas used for fair value estimate: 12/13" in trans_est_cnt
    assert not re.search(r"[\uac00-\ud7a3]", trans_est_cnt)

    # 5. Duplicate personas
    flag_dup = "중복 페르소나 응답 제외: 워런-버핏, 피터-린치"
    trans_dup = translate_review_flag_en(flag_dup)
    assert "Excluded duplicate persona responses" in trans_dup
    assert not re.search(r"[\uac00-\ud7a3]", trans_dup)

    # 6. Safety price adjust
    flag_safety = "안전마진 가격 후보가 적정가보다 높아 밴드 하단(Q1)으로 보정"
    trans_safety = translate_review_flag_en(flag_safety)
    assert "adjusted to band lower bound (Q1)" in trans_safety
    assert not re.search(r"[\uac00-\ud7a3]", trans_safety)

    # 7. Target exit price adjust
    flag_target = "목표 매도가 후보가 적정가보다 낮아 밴드 상단(Q3)으로 보정"
    trans_target = translate_review_flag_en(flag_target)
    assert "adjusted to band upper bound (Q3)" in trans_target
    assert not re.search(r"[\uac00-\ud7a3]", trans_target)


def test_clean_korean_from_en():
    s = "Votes: BUY 6 · HOLD 4 · WATCH 0 · SELL 2 · 유효 의견 12/13"
    cleaned = clean_korean_from_en(s)
    assert "유효 의견" not in cleaned
    assert "Valid Votes 12/13" in cleaned
