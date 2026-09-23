# 분석 리포트 스키마

> 이 스키마는 report 도메인이 생성하고, Supabase에 저장되며, auto-trading이 읽는 핵심 데이터 구조입니다.

## Report (Pydantic / TypeScript)

```python
# Python (Pydantic)
from pydantic import BaseModel
from typing import Literal
from datetime import date

class PersonaVote(BaseModel):
    persona: str          # "워런 버핏", "마이클 버리" 등
    verdict: Literal["BUY", "SELL", "HOLD", "WATCH"]
    confidence: int       # 0-10
    reason: str

class FinancialMetrics(BaseModel):
    ticker: str
    current_price: float
    per: float | None
    pbr: float | None
    roe: float | None
    gross_margin: float | None   # 매출총이익률
    revenue_growth: float | None

class Report(BaseModel):
    id: str | None = None
    ticker: str
    date: date
    verdict: Literal["BUY", "SELL", "HOLD", "WATCH"]
    confidence: int             # 0-100 (전체 확신도)
    summary: str                # 한국어 요약 (200자 이내)
    personas: list[PersonaVote]
    metrics: FinancialMetrics
    raw_llm_response: str | None = None
    created_at: str | None = None
```

```typescript
// TypeScript (ai-gateway에서 참조)
export type Verdict = 'BUY' | 'SELL' | 'HOLD' | 'WATCH'

export interface PersonaVote {
  persona: string
  verdict: Verdict
  confidence: number  // 0-10
  reason: string
}

export interface Report {
  id?: string
  ticker: string
  date: string       // ISO 날짜 (YYYY-MM-DD)
  verdict: Verdict
  confidence: number // 0-100
  summary: string
  personas: PersonaVote[]
  metrics: Record<string, number | null>
}
```

---

## verdict 결정 규칙

| verdict | 조건 |
|:---|:---|
| `BUY` | personas 중 BUY ≥ 50% AND confidence ≥ 60 |
| `SELL` | personas 중 SELL ≥ 40% |
| `HOLD` | BUY가 있으나 confidence < 60 |
| `WATCH` | 나머지 모든 경우 |

> auto-trading은 `BUY`이고 confidence ≥ 70일 때만 매수 실행

---

## Supabase content JSONB 구조

```json
{
  "summary": "NVDA는 AI 반도체 독점 지위로 인해 중장기 성장 가능하나...",
  "personas": [
    {
      "persona": "워런 버핏",
      "verdict": "HOLD",
      "confidence": 7,
      "reason": "위대한 기업이나 현재 PER 28.75배에서 안전마진 부족"
    }
  ],
  "metrics": {
    "current_price": 227.0,
    "per": 28.75,
    "pbr": 25.0,
    "roe": 117.0,
    "gross_margin": 74.67
  }
}
```
