# 서비스 간 API 스펙 (Source of Truth)

> **중요**: 이 문서는 3개 프로젝트 모두의 인터페이스 계약입니다.
> 변경 시 이 문서를 먼저 수정하고, 각 프로젝트에 반영하세요.

---

## 1. AI Gateway API

**Base URL**: `https://seedtick-ai-gateway.vercel.app`

### POST /v1/chat/completions

OpenAI 규격과 동일합니다.

**Request**
```json
{
  "model": "gemini-pro",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**Response (200)**
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "model": "gemini-pro",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

**Response (에러)**
```json
{
  "error": {
    "code": "GATEWAY_ALL_KEYS_EXHAUSTED",
    "message": "모든 LLM 키 소진됨",
    "type": "gateway_error"
  }
}
```

**Headers**
```
Authorization: Bearer {GATEWAY_SECRET}
Content-Type: application/json
```

---

## 2. Analyzer 내부 서비스 API

내부 FastAPI 엔드포인트 (외부 노출용이 아님)

### GET /health
```json
{ "status": "ok", "timestamp": "2026-09-22T09:00:00Z" }
```

### POST /screener/run
스크리닝 수동 실행

**Response (200)**
```json
{
  "tickers": ["NVDA", "TSLA", "AAPL"],
  "count": 3,
  "criteria": {
    "min_volume": 1000000,
    "min_price": 10
  }
}
```

### GET /api/screener/roma
DataRoma Grand Portfolio(`https://www.dataroma.com/m/g/portfolio.php?o=c`)를 스크레이핑해
슈퍼인베스터들이 공동 보유한 종목을 반환하는 **두번째 스크리너**. (기본: 보유자 10명 이상)

**Query Parameters**
- `min_holders`: 최소 보유 투자자 수 (기본: `10`, 범위: `1~200`)
- `size`: 조회 건수 상한 (기본: `0` = 전체)

**Response (200)**
```json
{
  "tickers": [
    {
      "ticker": "MSFT",
      "stock_code": "MSFT",
      "name": "Microsoft Corp.",
      "price": 525.18,
      "screeners": ["roma"],
      "holders": 37,
      "weight_pct": 1.779,
      "hold_price": 373.02,
      "week52_low": 348.54,
      "week52_high": 549.2
    }
  ],
  "total_count": 50,
  "count": 50,
  "criteria": { "preset": "roma", "nation": "us", "size": 200 },
  "source": "dataroma_grand_portfolio"
}
```

**Error (502)**: 스크레이핑/파싱 실패 시 `DataRoma 스크리너 실행 실패: ...`


### GET /api/screener/chart/{ticker}
특정 종목의 일봉 캔들스틱 데이터 및 볼린저 밴드(20일 SMA, ±2 표준편차) 계산 결과 조회

**Query Parameters**
- `range`: 조회 기간 (기본: `6mo`, 선택: `3mo`, `6mo`, `1y`)
- `interval`: 캔들 주기 (기본: `1d`)

**Response (200)**
```json
{
  "ticker": "AAPL",
  "period": "6mo",
  "interval": "1d",
  "candles": [
    { "time": "2024-04-01", "open": 170.0, "high": 172.5, "low": 169.5, "close": 171.2, "volume": 45000000 }
  ],
  "bollinger": [
    { "time": "2024-04-26", "upper": 175.4, "middle": 170.2, "lower": 165.0, "percent_b": 0.596 }
  ],
  "summary": {
    "current_price": 171.2,
    "upper": 175.4,
    "middle": 170.2,
    "lower": 165.0,
    "percent_b": 0.596,
    "bandwidth": 0.061,
    "status": "MIDDLE",
    "status_label": "중심선 영역",
    "status_description": "볼린저 밴드 중심선 부근에서 안정적인 추세를 유지하고 있어요."
  }
}
```

### POST /report/generate
단일 종목 리포트 생성

**Request**
```json
{ "ticker": "NVDA" }
```

**Response**: [report-schema.md](./report-schema.md) 참조

### POST /scheduler/trigger
수동으로 일일 배치 실행 (테스트/긴급 재실행용)

**Request**
```json
{ "dry_run": false }
```

**Response**
```json
{
  "job_id": "daily-2026-09-22",
  "status": "started",
  "tickers_queued": 5
}
```

---

## 3. Supabase 테이블 스키마

자세한 내용은 [report-schema.md](./report-schema.md) 참조

### reports 테이블
```sql
CREATE TABLE reports (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker      TEXT NOT NULL,
  date        DATE NOT NULL,
  verdict     TEXT CHECK (verdict IN ('BUY', 'SELL', 'HOLD', 'WATCH')),
  confidence  INTEGER CHECK (confidence BETWEEN 0 AND 100),
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);
```

### orders 테이블
```sql
CREATE TABLE orders (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker        TEXT NOT NULL,
  action        TEXT CHECK (action IN ('BUY', 'SELL')),
  amount_krw    INTEGER NOT NULL,
  status        TEXT CHECK (status IN ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED')),
  broker        TEXT NOT NULL,
  report_id     UUID REFERENCES reports(id),
  executed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date(created_at))
);
```
