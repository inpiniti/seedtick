"""
Report 도메인 데이터 모델 (Pydantic)
"""
from typing import Literal
from pydantic import BaseModel, Field


# ── 1. DataPack 모델 ─────────────────────────────────────
class FinancialStatementRow(BaseModel):
    year: str
    period: str | None = None
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
    period: str | None = None
    operating_cash_flow: float | None = None
    capex: float | None = None
    fcf: float | None = None
    fcf_margin_pct: float | None = None


class BalanceSheetRow(BaseModel):
    cash_and_investments: float | None = None
    total_debt: float | None = None
    net_debt: float | None = None
    stockholders_equity: float | None = None
    total_liabilities: float | None = None
    ncav: float | None = None  # 순유동자산가치 (Net Current Asset Value = 유동자산 - 부채총계)
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
    earnings_yield_pct: float | None = None  # EBIT / EV (그린블라트 이익수익률)
    graham_multiplier: float | None = None   # PER * PBR (그레이엄 22.5 기준)


class StockDataPack(BaseModel):
    """사전 수집/계산된 종목 심층 팩트 (Yahoo + SEC + Toss)"""
    ticker: str
    company_name: str
    company_name_en: str = ""        # 공식 영문 기업명 (Yahoo Finance longName/shortName)
    date: str                        # YYYY-MM-DD
    current_price: float
    currency: str = "USD"            # 주가 거래 통화 (예: USD)
    financial_currency: str = "USD"  # 재무제표 원장 통화 (예: KRW, USD)
    overview: str
    income_annual: list[FinancialStatementRow] = Field(default_factory=list)
    income_quarterly: list[FinancialStatementRow] = Field(default_factory=list)
    cashflow_annual: list[CashFlowRow] = Field(default_factory=list)
    cashflow_quarterly: list[CashFlowRow] = Field(default_factory=list)
    balance_sheet: BalanceSheetRow = Field(default_factory=BalanceSheetRow)
    valuation: ValuationRow
    market_metrics: dict = Field(default_factory=dict)
    analyst_consensus: dict = Field(default_factory=dict)
    news_items: list[dict] = Field(default_factory=list)
    ir_schedule: dict = Field(default_factory=dict)
    forensic_metrics: dict = Field(default_factory=dict)
    checklist_results: dict = Field(default_factory=dict)
    value_drivers: str = ""
    value_drivers_en: str = ""
    file_path: str = ""
    raw_markdown: str = ""


# ── 2. 13인 거장 요약 모델 ────────────────────────────────
class PersonaSummaryBlock(BaseModel):
    persona: str                     # 예: 워런-버핏
    verdict: Literal["매수", "보유", "관망", "매도", "미응답"]
    confidence: int | None = 5       # 1-10
    core_arguments: list[str]        # 수치와 팩트를 포함한 핵심 근거 2~3개 (한국어)
    core_arguments_en: list[str] = Field(default_factory=list)  # 영문 핵심 근거
    target_price_range: str | None = None
    target_price_low: float | None = None   # 적정가/매수 가격대 하단 (숫자)
    target_price_high: float | None = None  # 적정가/매수 가격대 상단 (숫자)
    fair_value: float | None = None         # 페르소나 산출 적정 내재가치
    buy_below: float | None = None          # 안전마진 매수가 상한
    sell_above: float | None = None         # 목표 매도가
    valuation_method: str | None = None     # DCF | NCAV | PEG | EV/EBIT | 추세 등
    horizon: str | None = None              # 1y | 3-5y | indefinite
    checklist: list[dict] = Field(default_factory=list)  # [{criterion, passed, value}]
    key_metrics_used: list[dict] = Field(default_factory=list)  # [{name, value}]
    prompt_hash: str | None = None          # 페르소나 프롬프트 템플릿 해시
    model: str | None = None                # 분석에 사용된 LLM 모델명
    data_gaps: list[str] = Field(default_factory=list)  # 데이터 부족 항목
    trigger_conditions: list[str] = Field(default_factory=list)  # 한국어 재검토 조건
    trigger_conditions_en: list[str] = Field(default_factory=list)  # 영문 재검토 조건
    quote: str                       # 인물 특유 어조의 대표 발언 1개 (한국어)
    quote_en: str = ""               # 영문 대표 발언 1개
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


# ── 3. 최종 종합 마스터 보고서 모델 ────────────────────────
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
    bull_points: list[str] = Field(default_factory=list)   # 강세론 논거 목록 (문자열)
    bear_points: list[str] = Field(default_factory=list)   # 약세론 논거 목록 (문자열)
    bull_arguments: list[dict] = Field(default_factory=list) # [{text, personas}] 출처 연결
    bear_arguments: list[dict] = Field(default_factory=list) # [{text, personas}] 출처 연결
    key_drivers: list[str] = Field(default_factory=list)   # 핵심 가치 드라이버 목록
    # ── 영문 다국어 필드 (i18n) ──
    company_name_en: str = ""                              # 영문 기업명
    conclusion_en: str = ""                                # 영문 종합 결론
    hot_topics_en: list[str] = Field(default_factory=list) # 영문 핵심 쟁점
    bull_points_en: list[str] = Field(default_factory=list)# 영문 강세론 논거
    bear_points_en: list[str] = Field(default_factory=list)# 영문 약세론 논거
    key_drivers_en: list[str] = Field(default_factory=list)# 영문 핵심 가치 드라이버
    final_report_en: str = ""                              # 영문 마크다운 본문
    band_low: float | None = None          # 적정 밴드 하단
    band_high: float | None = None         # 적정 밴드 상단
    safety_entry_value: float | None = None  # 안전마진 매수가 (숫자)
    target_sell_value: float | None = None   # 목표 매도가 (숫자)
    valuation_dispersion_pct: float | None = None  # 개별 추정 전체 범위 폭 / 적정가 중앙값
    valuation_estimate_count: int = 0       # 유효 페르소나 가격 구간 수
    mean_score: float | None = None         # 13인 평균 점수 (0.0=매수 ~ 3.0=매도)
    score_std: float | None = None          # 점수 표준편차
    net_buy_ratio: float | None = None      # 순매수 비율 ((매수-매도)/유효표)
    style_breakdown: dict = Field(default_factory=dict) # 스타일 버킷별 소계
    data_gap_watch_count: int = 0           # 데이터 부족으로 인한 관망 인원수
    model: str | None = None                # 분석 모델명
    parse_mode: Literal["json", "regex"] = "regex"
    file_path: str = ""
    raw_markdown: str = ""
