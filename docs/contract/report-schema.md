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

## verdict 결정 규칙 및 점수 매핑

| 의견 | DB 점수 (`smallint`) | 설명 |
|:---|:---:|:---|
| `매수` (`BUY`) | **0** | 가장 긍정적 |
| `보유` (`HOLD`) | **1** | 기존 물량 유지, 신규 진입 신중 |
| `관망` (`WATCH`) | **2** | 안전마진 부족 또는 지표 대기 |
| `매도` (`SELL`) | **3** | 가장 부정적, 펀더멘털 훼손 또는 고평가 |

- **종합 점수 (`g0`)**: 13인 거장 점수의 최빈값 (동률일 경우 더 보수적인 쪽 선택)
- **auto-trading 매수 조건**: `g0 == 0` (종합 매수) 및 확신도 상위 종목

---

---

## Supabase DB 스키마 (`guru_reports` & `guru_votes`)

### 1. `guru_reports` 테이블 (추후 어날리시스 및 리포트 본문 조회용)
```sql
create table if not exists public.guru_reports (
  id            text        not null primary key, -- {date}_{ticker} (예: 2026-09-23_NVDA)
  d             date        not null,             -- 분석 일자
  ticker        text        not null,             -- 종목 티커 (예: NVDA)
  company_name  text,                             -- 기업명
  current_price numeric,                          -- 분석 당시 주가 (USD)
  verdict       text        not null,             -- 종합 의견 (매수 / 보유 / 관망 / 매도)
  overall_score smallint    not null,             -- 종합 점수 (0: 매수, 1: 보유, 2: 관망, 3: 매도)
  vote_summary  text,                             -- 표결 요약 (예: 매수 8 · 보유 3 · 관망 1 · 매도 1)
  datapack      jsonb,                            -- 공용 심층 팩트 (재무제표 시계열, 밸류에이션, 지표)
  summaries     jsonb,                            -- 13인 거장 개별 요약 블록 배열
  discussion    text,                             -- 거장 원탁 토론 전문 마크다운
  final_report  text,                             -- 최종 마스터 종합 투자 보고서 마크다운
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### 2. `guru_votes` 테이블 (스크리너 랭킹 및 13인 점수 연동용)
```sql
create table if not exists public.guru_votes (
  d           date        not null,       -- 분석 일자
  ticker      text        not null,       -- 티커 (예: NVDA)
  name        text,                       -- 종목명
  nation      text        not null default 'us',
  screeners   text[],                     -- 통과한 스크리너 프리셋 목록 (예: ['공통'])
  g0  smallint,                           -- 종합 점수 (0: 매수 ~ 3: 매도)
  g1  smallint, -- 벤저민 그레이엄
  g2  smallint, -- 세스 클라먼
  g3  smallint, -- 모니시 파브라이
  g4  smallint, -- 조엘 그린블라트
  g5  smallint, -- 앙드레 코스톨라니
  g6  smallint, -- 잭 슈웨거
  g7  smallint, -- 워런 버핏
  g8  smallint, -- 필립 피셔
  g9  smallint, -- 뉴욕주민 / 찰리 멍거
  g10 smallint, -- 피터 린치
  g11 smallint, -- 애스워스 다모다란
  g12 smallint, -- 존 템플턴
  g13 smallint, -- 마이클 버리
  updated_at  timestamptz not null default now(),
  primary key (d, ticker)
);
```

---

## 산출물 파일 저장 규칙

```text
docs/report/{YYYY-MM-DD}/
├── _data/
│   ├── {티커}.md            # 공용 심층 데이터팩
│   └── {티커}_요약.md       # 13인 개별 요약 블록 모음
└── 최종/
    ├── {티커}_토론.md       # 거장 원탁 토론 전문
    └── {티커}_최종보고서.md  # 최종 종합 마스터 투자 보고서
```
