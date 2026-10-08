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

- **종합 점수 (`g0`)**: 유효 응답 12개 이상일 때, 가장 많은 의견이 유효 표의 60% 이상인 경우 해당 의견 점수. 그 외에는 `관망` 점수(2)
- **auto-trading 매수 조건**: `g0 == 0` (종합 매수) 및 확신도 상위 종목

보고서 표결은 공식 13인 roster만 대상으로 한다. 스크리너의 `뉴욕주민` 항목은 별도 보고서 인원으로 더하지 않고 g9는 찰리 멍거로 통일한다. API 오류나 유효하지 않은 출력은 fallback으로 기록하고 표결 수에서 제외한다.

적정가는 가격 구간별 중점값 중앙값이다. 밴드는 Q1–Q3로 표시하고, 적정가 분산은 최저~최고 중점값 폭을 중앙값으로 나눈 값이다. 분산이 20%를 넘거나 유효 가격 구간이 8개 미만이면 단일 적정가와 실행 가격을 표시하지 않는다. 과거 보고서 결과를 기준값으로 삼아 새 결과를 당기지 않는다.

`datapack.analysis_metadata`에는 보고서 모델, temperature, prompt version, 결정 정책 버전, 입력 fingerprint를 저장한다. 평균 확신도는 각 페르소나의 자기보고 평균이며 예측 정확도 지표가 아니다.

---

---

## Supabase DB 스키마 (`guru_reports` & `guru_votes`)

### 1. `guru_reports` 테이블 (심층 투자 보고서 마스터)
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
  -- ── 구조화 검색/정렬 컬럼 ──
  fair_value         numeric,                     -- 종합 적정 내재가치 ($)
  band_low           numeric,                     -- 적정 밴드 하단 ($)
  band_high          numeric,                     -- 적정 밴드 상단 ($)
  safety_entry       numeric,                     -- 안전마진 매수가 ($)
  target_sell        numeric,                     -- 목표 매도가 ($)
  upside_pct         numeric,                     -- 적정가 대비 상승여력 (%)
  votes_buy          smallint,                    -- 매수 표수
  votes_hold         smallint,                    -- 보유 표수
  votes_watch        smallint,                    -- 관망 표수
  votes_sell         smallint,                    -- 매도 표수
  avg_confidence     numeric,                     -- 거장 평균 확신도 (1~10)
  conclusion         text,                        -- 종합 결론 핵심 문장
  hot_topics         text[],                      -- 핵심 쟁점 목록
  bull_points        text[],                      -- 강세론 핵심 논거 목록
  bear_points        text[],                      -- 약세론 핵심 논거 목록
  key_drivers        text[],                      -- 핵심 가치 드라이버 목록
  action_guide       jsonb,                       -- 실전 투자 실행 가이드 (가격대/손익비 등)
  valuation_flags    text[],                      -- 밸류에이션 검증 플래그
  parse_mode         text,                        -- 파싱 모드 (json / regex)
  prompt_version     text,                        -- 프롬프트 버전
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### 1-1. `guru_opinions` 테이블 (13인 거장 개별 평가 롱 포맷 상세)
```sql
create table if not exists public.guru_opinions (
  id              bigint generated always as identity primary key,
  report_id       text        not null references public.guru_reports(id) on delete cascade,
  d               date        not null,
  ticker          text        not null,
  persona         text        not null,            -- 예: '워런-버핏'
  guru_idx        smallint,                        -- 1~13 (guru_votes g1~g13 대응)
  verdict         text        not null,            -- 매수 / 보유 / 관망 / 매도
  score           smallint    not null,            -- 0: 매수, 1: 보유, 2: 관망, 3: 매도
  confidence      smallint,                        -- 1~10
  target_low      numeric,                         -- 적정가/매수가 하단
  target_high     numeric,                         -- 적정가/매수가 상단
  target_text     text,                            -- 원본 가격 텍스트 (예: "$150~$175")
  upside_pct      numeric,                         -- (중간적정가 / 현재가 - 1) * 100
  arguments       text[],                          -- 핵심 논거 불릿 리스트
  triggers        text[],                          -- 트리거 조건 리스트
  quote           text,                            -- 대표 발언
  parse_mode      text,                            -- json / regex / fallback / legacy
  prompt_version  text,                            -- 프롬프트 버전
  raw_text        text,                            -- AI 모델 원문 응답
  created_at      timestamptz not null default now(),
  constraint guru_opinions_report_persona_unique unique (report_id, persona)
);
```

### 1-2. `report_metrics` 테이블 (재무/지표 숫자 컬럼 정규화)
```sql
create table if not exists public.report_metrics (
  report_id           text        primary key references public.guru_reports(id) on delete cascade,
  d                   date        not null,
  ticker              text        not null,
  current_price       numeric,
  market_cap          numeric,
  enterprise_value    numeric,
  per                 numeric,
  fwd_per             numeric,
  peg                 numeric,
  pbr                 numeric,
  psr                 numeric,
  pfcf                numeric,
  ev_ebitda           numeric,
  dividend_yield_pct  numeric,
  roe_pct             numeric,
  roa_pct             numeric,
  roic_pct            numeric,
  debt_ratio          numeric,
  current_ratio       numeric,
  net_debt            numeric,
  fiscal_year         text,
  revenue             numeric,
  revenue_growth_pct  numeric,
  gross_margin_pct    numeric,
  operating_margin_pct numeric,
  net_margin_pct      numeric,
  eps                 numeric,
  fcf                 numeric,
  fcf_margin_pct      numeric,
  high_52w            numeric,
  low_52w             numeric,
  from_52w_high_pct   numeric,
  ma50                numeric,
  ma200               numeric,
  short_float_pct     numeric,
  insider_pct         numeric,
  institution_pct     numeric,
  analyst_target_mean numeric,
  analyst_target_high numeric,
  analyst_target_low  numeric,
  analyst_upside_pct  numeric,
  analyst_rating      text,
  created_at          timestamptz not null default now()
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
  g9  smallint, -- 찰리 멍거 (레거시 보고서 별칭: 뉴욕주민)
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
