"""
P0, P1, P2 보고서 파이프라인 전면 개선 사항에 대한 통합 단위 테스트.
"""

from __future__ import annotations

import pandas as pd
import pytest

from app.domains.report.checklist_evaluator import (
    evaluate_guru_checklists,
    format_checklist_markdown,
)
from app.domains.report.decision_engine import (
    GURU_STYLE_BUCKETS,
    aggregate_report_consensus,
)
from app.domains.report.models import (
    BalanceSheetRow,
    CashFlowRow,
    FinancialStatementRow,
    PersonaSummaryBlock,
    StockDataPack,
    ValuationRow,
)
from app.domains.report.outcome_tracker import evaluate_report_outcomes
from app.domains.report.personas.prompts import (
    build_persona_prompt,
    get_persona_prompt_hash,
)
from app.domains.report.structuring import (
    build_opinion_check_rows,
    build_opinion_rows,
    build_report_columns,
)


def _make_dummy_datapack() -> StockDataPack:
    return StockDataPack(
        ticker="AAPL",
        company_name="Apple Inc.",
        overview="글로벌 IT 선도 기업",
        date="2026-03-01",
        current_price=150.0,
        currency="USD",
        valuation=ValuationRow(
            current_price=150.0,
            market_cap=2_400_000_000_000.0,
            enterprise_value=2_450_000_000_000.0,
            trailing_pe=20.0,
            pbr=1.1,
            ev_ebitda=14.0,
            earnings_yield_pct=7.5,
            graham_multiplier=22.0,
        ),
        balance_sheet=BalanceSheetRow(
            cash_and_investments=30_000_000_000.0,
            total_debt=80_000_000_000.0,
            net_debt=50_000_000_000.0,
            stockholders_equity=120_000_000_000.0,
            total_liabilities=230_000_000_000.0,
            ncav=-90_000_000_000.0,
            roe_pct=25.0,
            current_ratio=1.4,
            debt_ratio=150.0,
            roic_pct=22.0,
        ),
        income_annual=[
            FinancialStatementRow(
                year="2024",
                revenue=380_000_000_000.0,
                operating_income=110_000_000_000.0,
                net_income=90_000_000_000.0,
                eps=6.0,
            ),
            FinancialStatementRow(
                year="2025",
                revenue=400_000_000_000.0,
                operating_income=120_000_000_000.0,
                net_income=100_000_000_000.0,
                eps=6.5,
            ),
        ],
        cashflow_annual=[
            CashFlowRow(
                year="2025",
                operating_cash_flow=115_000_000_000.0,
                capex=12_000_000_000.0,
                fcf=103_000_000_000.0,
            )
        ],
        market_metrics={
            "50일 이동평균선": 145.0,
            "200일 이동평균선": 140.0,
        },
        forensic_metrics={
            "total_liabilities": 250_000_000_000.0,
            "stock_based_compensation": 10_000_000_000.0,
            "diluted_shares_latest": 15_500_000_000.0,
            "diluted_shares_prev": 16_000_000_000.0,
            "inventory_latest": 6_500_000_000.0,
            "inventory_prev": 6_000_000_000.0,
            "ebit_latest": 120_000_000_000.0,
        },
    )


def test_checklist_evaluator():
    dp = _make_dummy_datapack()
    checklists = evaluate_guru_checklists(dp)
    assert isinstance(checklists, dict)

    # 벤저민 그레이엄 체크리스트
    graham = checklists.get("벤저민-그레이엄", [])
    assert len(graham) >= 3
    crit_names = [c["criterion"] for c in graham]
    assert any("PER × PBR" in n for n in crit_names)
    assert any("유동비율" in n for n in crit_names)

    # 조엘 그린블라트
    greenblatt = checklists.get("조엘-그린블라트", [])
    assert len(greenblatt) >= 2
    assert any("이익수익률" in c["criterion"] for c in greenblatt)

    # 워런 버핏
    buffett = checklists.get("워런-버핏", [])
    assert any("자기자본이익률" in c["criterion"] for c in buffett)

    # 마크다운 렌더링 검증
    md = format_checklist_markdown(graham)
    assert "PER × PBR" in md
    assert "PASS" in md


def test_persona_prompt_hash_and_anchoring_guard():
    h1 = get_persona_prompt_hash("워런-버핏")
    h2 = get_persona_prompt_hash("워런-버핏")
    h3 = get_persona_prompt_hash("벤저민-그레이엄")
    assert h1 == h2
    assert h1 != h3
    assert len(h1) == 12

    # 독립 가치투자자에게는 월가 앵커링 방지 가이드가 포함되어야 함
    prompt_graham = build_persona_prompt("벤저민-그레이엄", "Data Pack Markdown", "Checklist MD")
    assert "[Independent Valuation Mandate]" in prompt_graham
    assert "[Pre-Calculated Quantitative Checklist for" in prompt_graham

    # 피터 린치에게는 앵커링 방지 대신 일반 분석
    prompt_lynch = build_persona_prompt("피터-린치", "Data Pack Markdown")
    assert "[Independent Valuation Mandate]" not in prompt_lynch


def test_decision_engine_continuous_scores_and_styles():
    personas = [
        PersonaSummaryBlock(
            persona="워런-버핏", verdict="매수", confidence=9,
            fair_value=170.0, buy_below=155.0, sell_above=210.0,
            quote="훌륭한 기업을 적정가에 산다.",
            core_arguments=["해자 견고", "ROE 25%"],
        ),
        PersonaSummaryBlock(
            persona="찰리-멍거", verdict="매수", confidence=8,
            fair_value=165.0, buy_below=150.0, sell_above=200.0,
            quote="어리석은 짓을 피하라.",
            core_arguments=["비즈니스 질 우수"],
        ),
        PersonaSummaryBlock(
            persona="벤저민-그레이엄", verdict="관망", confidence=6,
            fair_value=130.0, buy_below=110.0, sell_above=145.0,
            data_gaps=["NCAV 청산가치 부족"],
            quote="안전마진을 지켜라.",
            core_arguments=["안전마진 부족"],
        ),
        PersonaSummaryBlock(
            persona="피터-린치", verdict="매수", confidence=8,
            fair_value=180.0, buy_below=160.0, sell_above=220.0,
            quote="아는 것에 투자하라.",
            core_arguments=["PEG 매력적"],
        ),
        PersonaSummaryBlock(
            persona="마이클-버리", verdict="매도", confidence=7,
            fair_value=115.0, buy_below=95.0, sell_above=130.0,
            quote="숫자는 거짓말하지 않는다.",
            core_arguments=["밸류에이션 과열"],
        ),
    ]

    consensus = aggregate_report_consensus(personas)
    assert consensus.mean_score is not None
    assert consensus.score_std is not None
    assert consensus.net_buy_ratio is not None
    assert consensus.data_gap_watch_count == 1
    assert "가치/안전마진" in consensus.style_breakdown
    assert "성장/GARP" in consensus.style_breakdown


def test_structuring_new_fields_and_check_rows():
    summaries = [
        {
            "persona": "워런-버핏",
            "verdict": "매수",
            "confidence": 9,
            "fair_value": 180.0,
            "buy_below": 160.0,
            "sell_above": 230.0,
            "valuation_method": "DCF",
            "horizon": "indefinite",
            "checklist": [{"criterion": "ROE >= 15%", "passed": True, "value": "25.0%"}],
            "key_metrics_used": [{"name": "ROE", "value": "25.0%"}],
            "data_gaps": [],
            "core_arguments": ["견고한 해자와 높은 자본이익률"],
            "trigger_conditions": ["경영진 교체"],
            "quote": "좋은 기업을 적정가에 사라",
            "parse_mode": "json",
            "prompt_hash": "a1b2c3d4e5f6",
        }
    ]

    opinion_rows = build_opinion_rows(
        report_id="2026-03-01_AAPL",
        date_str="2026-03-01",
        ticker="AAPL",
        current_price=150.0,
        summaries=summaries,
        model="gpt-4o",
    )
    assert len(opinion_rows) == 1
    row = opinion_rows[0]
    assert row["guru_id"] == 7  # 워런 버핏 id
    assert row["fair_value"] == 180.0
    assert row["buy_below"] == 160.0
    assert row["valuation_method"] == "DCF"
    assert row["model"] == "gpt-4o"

    # check rows 생성
    check_rows = build_opinion_check_rows("2026-03-01_AAPL", opinion_rows)
    assert len(check_rows) == 1
    assert check_rows[0]["criterion"] == "ROE >= 15%"
    assert check_rows[0]["passed"] is True

    # report columns 생성
    rep_cols = build_report_columns(
        current_price=150.0,
        summaries=summaries,
        fair_value=180.0,
        target_price_band="$160 ~ $200",
        safety_entry_price="$160 이하",
        optimistic_target_price="$230",
        mean_score=0.25,
        score_std=0.5,
        net_buy_ratio=0.8,
        style_breakdown={"가치": {"매수": 1}},
        data_gap_watch_count=0,
        model="gpt-4o",
    )
    assert rep_cols["mean_score"] == 0.25
    assert rep_cols["model"] == "gpt-4o"
    assert rep_cols["style_breakdown"] == {"가치": {"매수": 1}}


def test_outcome_tracker_evaluation():
    dates = pd.date_range("2026-01-01", periods=100, freq="B")
    stock_df = pd.DataFrame(
        {
            "Open": [100.0 + i * 0.5 for i in range(100)],
            "High": [105.0 + i * 0.5 for i in range(100)],
            "Low": [95.0 + i * 0.5 for i in range(100)],
            "Close": [102.0 + i * 0.5 for i in range(100)],
        },
        index=dates,
    )
    spy_df = pd.DataFrame(
        {
            "Open": [400.0 + i * 0.2 for i in range(100)],
            "High": [402.0 + i * 0.2 for i in range(100)],
            "Low": [398.0 + i * 0.2 for i in range(100)],
            "Close": [401.0 + i * 0.2 for i in range(100)],
        },
        index=dates,
    )

    report = {
        "id": "2026-01-01_TEST",
        "ticker": "TEST",
        "d": "2026-01-01",
        "current_price": 100.0,
        "fair_value": 115.0,
        "verdict": "매수",
    }
    opinions = [
        {"id": 101, "persona": "워런-버핏", "verdict": "매수", "confidence": 9},
        {"id": 102, "persona": "마이클-버리", "verdict": "매도", "confidence": 8},
    ]

    rep_outcomes, op_outcomes = evaluate_report_outcomes(
        report, stock_df, spy_df, opinions, horizons=[21, 63]
    )
    assert len(rep_outcomes) == 2  # 21일, 63일
    assert rep_outcomes[0]["horizon_days"] == 21
    assert rep_outcomes[0]["return_pct"] > 0
    assert rep_outcomes[0]["hit_fair_value"] is not None

    assert len(op_outcomes) == 4  # 2의견 × 2시계
    buffett_21 = next(o for o in op_outcomes if o["persona"] == "워런-버핏" and o["horizon_days"] == 21)
    assert buffett_21["is_correct"] is True  # 매수인데 주가 상승
    burry_21 = next(o for o in op_outcomes if o["persona"] == "마이클-버리" and o["horizon_days"] == 21)
    assert burry_21["is_correct"] is False  # 매도인데 주가 상승
