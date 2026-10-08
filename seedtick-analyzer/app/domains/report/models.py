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
    currency: str = "USD"            # 주가 거래 통화 (예: USD)
    financial_currency: str = "USD"  # 재무제표 원장 통화 (예: KRW, USD)
    overview: str
    income_annual: list[FinancialStatementRow] = Field(default_factory=list)
    cashflow_annual: list[CashFlowRow] = Field(default_factory=list)
    balance_sheet: BalanceSheetRow = Field(default_factory=BalanceSheetRow)
    valuation: ValuationRow
    market_metrics: dict = Field(default_factory=dict)
    analyst_consensus: dict = Field(default_factory=dict)
    news_items: list[dict] = Field(default_factory=list)
    ir_schedule: dict = Field(default_factory=dict)
    value_drivers: str = ""
    file_path: str = ""
    raw_markdown: str = ""


# ── 2. 13인 거장 요약 모델 ────────────────────────────────
class PersonaSummaryBlock(BaseModel):
    persona: str                     # 예: 워런-버핏
    verdict: Literal["매수", "보유", "관망", "매도"]
    confidence: int                  # 1-10
    core_arguments: list[str]        # 수치와 팩트를 포함한 핵심 근거 2~3개
    target_price_range: str | None = None
    target_price_low: float | None = None   # 적정가/매수 가격대 하단 (숫자)
    target_price_high: float | None = None  # 적정가/매수 가격대 상단 (숫자)
    trigger_conditions: list[str] = Field(default_factory=list)
    quote: str                       # 인물 특유 어조의 대표 발언 1개
    # 파싱 출처: json(구조화 출력 성공) / regex(텍스트 폴백) / fallback(AI 실패 기본값)
    parse_mode: Literal["json", "regex", "fallback"] = "regex"
    # AI 원문 응답 (guru_opinions.raw_text 저장용, summaries jsonb 에는 제외)
    raw_text: str = Field(default="", exclude=True)


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
    fair_value_price: float | None = None       # 종합 적정 내재가치 (숫자, 예: 185.0)
    target_price_band: str | None = None       # 적정 밴드 (예: "$155 ~ $230")
    safety_entry_price: str | None = None      # 안전마진 매수가 (예: "$160 이하")
    optimistic_target_price: str | None = None # 낙관적 목표가 (예: "$230")
    valuation_review_flags: list[str] = Field(default_factory=list)
    bull_case: str
    bear_case: str
    value_drivers: list[str] = Field(default_factory=list)
    action_guide: dict = Field(default_factory=dict)
    persona_scores: dict[str, int] = Field(default_factory=dict)  # {g1: 0, g2: 1, ...}
    # ── 구조화 필드 (guru_reports 정규 컬럼으로 저장) ──
    conclusion: str = ""                                   # 종합 결론 1~2문장
    hot_topics: list[str] = Field(default_factory=list)    # 핵심 쟁점 2~3개
    bull_points: list[str] = Field(default_factory=list)   # 강세론 논거 목록
    bear_points: list[str] = Field(default_factory=list)   # 약세론 논거 목록
    key_drivers: list[str] = Field(default_factory=list)   # 핵심 가치 드라이버 목록
    band_low: float | None = None          # 적정 밴드 하단
    band_high: float | None = None         # 적정 밴드 상단
    safety_entry_value: float | None = None  # 안전마진 매수가 (숫자)
    target_sell_value: float | None = None   # 목표 매도가 (숫자)
    valuation_dispersion_pct: float | None = None  # 개별 추정 전체 범위 폭 / 적정가 중앙값
    valuation_estimate_count: int = 0       # 유효 페르소나 가격 구간 수
    parse_mode: Literal["json", "regex"] = "regex"
    file_path: str = ""
    raw_markdown: str = ""
    discussion: str = Field(default="", description="13인 거장 원탁 토론 전문 마크다운")
