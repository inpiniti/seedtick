"""
Report 도메인 데이터 모델 (Pydantic)
"""
from typing import Literal
from pydantic import BaseModel, Field


# ── 1. DataPack 모델 ─────────────────────────────────────
class FinancialStatementRow(BaseModel):
    year: str
    revenue: float | None = None
    revenue_growth_pct: float | None = None
    gross_profit: float | None = None
    gross_margin_pct: float | None = None
    operating_income: float | None = None
    operating_margin_pct: float | None = None
    net_income: float | None = None
    net_margin_pct: float | None = None
    eps: float | None = None


class CashFlowRow(BaseModel):
    year: str
    operating_cash_flow: float | None = None
    capex: float | None = None
    fcf: float | None = None
    fcf_margin_pct: float | None = None


class BalanceSheetRow(BaseModel):
    cash_and_investments: float | None = None
    total_debt: float | None = None
    net_debt: float | None = None
    stockholders_equity: float | None = None
    debt_ratio: float | None = None
    current_ratio: float | None = None
    roe_pct: float | None = None
    roa_pct: float | None = None
    roic_pct: float | None = None


class ValuationRow(BaseModel):
    current_price: float
    market_cap: float | None = None
    enterprise_value: float | None = None
    trailing_pe: float | None = None
    forward_pe: float | None = None
    peg: float | None = None
    pbr: float | None = None
    psr: float | None = None
    pfcf: float | None = None
    ev_ebitda: float | None = None
    dividend_yield_pct: float | None = None


class StockDataPack(BaseModel):
    """사전 수집/계산된 종목 심층 팩트 (Yahoo + SEC + Toss)"""
    ticker: str
    company_name: str
    date: str                        # YYYY-MM-DD
    current_price: float
    overview: str
    income_annual: list[FinancialStatementRow] = Field(default_factory=list)
    cashflow_annual: list[CashFlowRow] = Field(default_factory=list)
    balance_sheet: BalanceSheetRow = Field(default_factory=BalanceSheetRow)
    valuation: ValuationRow
    market_metrics: dict = Field(default_factory=dict)
    analyst_consensus: dict = Field(default_factory=dict)
    file_path: str = ""
    raw_markdown: str = ""


# ── 2. 13인 거장 요약 모델 ────────────────────────────────
class PersonaSummaryBlock(BaseModel):
    persona: str                     # 예: 워런-버핏
    verdict: Literal["매수", "보유", "관망", "매도"]
    confidence: int                  # 1-10
    core_arguments: list[str]        # 수치와 팩트를 포함한 핵심 근거 2~3개
    target_price_range: str | None = None
    trigger_conditions: list[str] = Field(default_factory=list)
    quote: str                       # 인물 특유 어조의 대표 발언 1개


class GuruSummaryDoc(BaseModel):
    ticker: str
    date: str
    summaries: list[PersonaSummaryBlock]
    file_path: str = ""
    raw_markdown: str = ""


# ── 3. 원탁 토론 모델 ─────────────────────────────────────
class GuruDiscussionDoc(BaseModel):
    ticker: str
    date: str
    hot_topics: list[str] = Field(default_factory=list)
    dialogue: str
    final_vote_counts: dict[str, int] = Field(default_factory=dict)
    file_path: str = ""
    raw_markdown: str = ""


# ── 4. 최종 종합 마스터 보고서 모델 ────────────────────────
class FinalMasterReport(BaseModel):
    ticker: str
    date: str
    overall_verdict: Literal["매수", "보유", "관망", "매도"]
    overall_score: int               # 0: 매수, 1: 보유, 2: 관망, 3: 매도 (g0)
    vote_summary: str                # "매수 8 · 보유 3 · 관망 1 · 매도 1"
    bull_case: str
    bear_case: str
    value_drivers: list[str] = Field(default_factory=list)
    action_guide: dict = Field(default_factory=dict)
    persona_scores: dict[str, int] = Field(default_factory=dict)  # {g1: 0, g2: 1, ...}
    file_path: str = ""
    raw_markdown: str = ""
