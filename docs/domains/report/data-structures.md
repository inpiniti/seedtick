# Report 데이터 구조

> 전체 스키마는 [contract/report-schema.md](../../contract/report-schema.md) 참조

## 내부 데이터 구조

```python
from pydantic import BaseModel
from typing import Literal

class FinancialMetrics(BaseModel):
    """LLM에 전달할 재무 지표"""
    ticker: str
    name: str
    current_price: float
    week52_high: float | None
    week52_low: float | None
    per: float | None           # PER (주가수익비율)
    forward_per: float | None   # Forward PER
    pbr: float | None           # PBR (주가순자산비율)
    roe: float | None           # ROE (자기자본이익률)
    gross_margin: float | None  # 매출총이익률
    revenue_growth: float | None
    market_cap_b: float | None  # 시총 (십억 달러)
    sector: str | None
    industry: str | None

class PersonaVote(BaseModel):
    persona: str
    verdict: Literal["BUY", "SELL", "HOLD", "WATCH"]
    confidence: int             # 0-10
    reason: str

class Report(BaseModel):
    id: str | None = None
    ticker: str
    date: str                   # YYYY-MM-DD
    verdict: Literal["BUY", "SELL", "HOLD", "WATCH"]
    confidence: int             # 0-100 집계 확신도
    summary: str                # 200자 이내 요약
    personas: list[PersonaVote]
    metrics: FinancialMetrics
    raw_llm_response: str | None = None
```

## LLM 프롬프트 구조

```
[System]
당신은 {persona}입니다.
다음 종목에 대해 당신의 투자 철학으로 분석해주세요.

[User]
종목: {ticker} ({name})
현재가: ${current_price}
PER: {per}x | Forward PER: {forward_per}x
PBR: {pbr}x | ROE: {roe}%
매출총이익률: {gross_margin}%
52주 고가/저가: ${week52_high} / ${week52_low}

판단:
- 의견: BUY / SELL / HOLD / WATCH 중 하나
- 확신도: 0-10
- 근거: (한국어로 2-3문장)
```

## LLM 응답 파싱 형식

```
인물: {persona} | 의견: {verdict} | 확신도: {confidence} | 근거: {reason}
```

예시 (NVDA_votes.txt 형식과 동일):
```
인물: 워런 버핏 | 의견: 보유 | 확신도: 7 | 근거: 위대한 기업이나 현재 가격에서...
```
