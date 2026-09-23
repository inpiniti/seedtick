# Report 데이터 구조

> 전체 스키마는 [contract/report-schema.md](../../contract/report-schema.md) 참조

## 1. 공용 데이터팩 데이터 구조 (DataPack)

```python
from pydantic import BaseModel, Field
from typing import Literal

class IncomeStatementYear(BaseModel):
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

class CashFlowYear(BaseModel):
    year: str
    operating_cash_flow: float | None = None
    capex: float | None = None
    fcf: float | None = None
    fcf_margin_pct: float | None = None

class BalanceSheetSnapshot(BaseModel):
    cash_and_investments: float | None = None
    total_debt: float | None = None
    net_debt: float | None = None
    stockholders_equity: float | None = None
    debt_ratio: float | None = None
    current_ratio: float | None = None
    roe_pct: float | None = None
    roa_pct: float | None = None
    roic_pct: float | None = None

class ValuationMetrics(BaseModel):
    current_price: float
    market_cap: float
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
    """사전 수집/계산된 종목 심층 팩트 (Yahoo + Toss + SEC)"""
    ticker: str
    company_name: str
    date: str                        # YYYY-MM-DD
    overview: str                    # 사업 모델, 해자, 매출 비중
    income_annual: list[IncomeStatementYear]
    cashflow_annual: list[CashFlowYear]
    balance_sheet: BalanceSheetSnapshot
    valuation: ValuationMetrics
    market_metrics: dict             # 52주 고저, 공매도 비율, 이동평균선
    analyst_consensus: dict          # 투자의견, 목표주가
    raw_markdown: str                # docs/report/{date}/_data/{ticker}.md 전문
```

---

## 2. 13인 거장 요약 블록 (PersonaSummaryBlock)

```python
class PersonaSummaryBlock(BaseModel):
    """거장 1인의 요약 블록"""
    persona: str                     # 예: 워런-버핏
    verdict: Literal["매수", "보유", "관망", "매도"]
    confidence: int                  # 1-10
    core_arguments: list[str]        # 수치/팩트 기반 논거 2~3개
    target_price_range: str | None = None  # 적정가/매수 가격대
    trigger_conditions: list[str]    # 재검토 조건 1~2개
    quote: str                       # 인물 어조가 담긴 대표 발언 1문장

class GuruSummaryDoc(BaseModel):
    """docs/report/{date}/_data/{ticker}_요약.md 구조"""
    ticker: str
    date: str
    summaries: list[PersonaSummaryBlock]
    raw_markdown: str
```

---

## 3. 거장 원탁 토론 및 최종 보고서

```python
class GuruDiscussionDoc(BaseModel):
    """docs/report/{date}/최종/{ticker}_토론.md"""
    ticker: str
    date: str
    hot_topics: list[str]            # 핵심 격돌 쟁점
    dialogue: str                    # 거장 간 치열한 상호 반박 전문
    final_vote_counts: dict[str, int] # {"매수": 8, "보유": 3, "관망": 1, "매도": 1}
    raw_markdown: str

class FinalMasterReport(BaseModel):
    """docs/report/{date}/최종/{ticker}_최종보고서.md"""
    ticker: str
    date: str
    overall_verdict: Literal["매수", "보유", "관망", "매도"]
    vote_summary: str                # 매수 n · 보유 n · 관망 n · 매도 n
    bull_case: str                   # 강세론 핵심
    bear_case: str                   # 약세론 핵심
    value_drivers: list[str]         # 핵심 드라이버 KPI
    action_guide: dict               # 분할 진입 가격대, 손익비 기준, 손절선
    guru_summary_table: str          # 13인 요약 마크다운 표
    raw_markdown: str
```

