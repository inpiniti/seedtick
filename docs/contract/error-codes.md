# 공통 에러 코드 규칙

## 에러 코드 형식

```
{DOMAIN}_{ERROR_TYPE}
```

예시: `GATEWAY_KEY_EXHAUSTED`, `SCREENER_FETCH_FAILED`

---

## AI-Gateway 에러 코드

| 코드 | HTTP | 설명 |
|:---|:---:|:---|
| `GATEWAY_AUTH_FAILED` | 401 | Bearer 토큰 인증 실패 |
| `GATEWAY_KEY_EXHAUSTED` | 503 | 단일 키 소진 (자동으로 다음 키 시도) |
| `GATEWAY_ALL_KEYS_EXHAUSTED` | 503 | 모든 키 소진 |
| `GATEWAY_MODEL_NOT_SUPPORTED` | 400 | 지원하지 않는 모델 |
| `GATEWAY_UPSTREAM_TIMEOUT` | 504 | LLM 응답 타임아웃 |

---

## Analyzer 에러 코드

### Screener
| 코드 | 설명 |
|:---|:---|
| `SCREENER_FETCH_FAILED` | 주식 데이터 수집 실패 |
| `SCREENER_EMPTY_RESULT` | 스크리닝 결과 없음 |

### Report
| 코드 | 설명 |
|:---|:---|
| `REPORT_AI_FAILED` | LLM 호출 실패 (gateway 에러 포함) |
| `REPORT_PARSE_FAILED` | LLM 응답 파싱 실패 |
| `REPORT_ALREADY_EXISTS` | 해당 날짜 리포트 이미 존재 |

### Scheduler
| 코드 | 설명 |
|:---|:---|
| `SCHEDULER_JOB_ALREADY_RUNNING` | 이미 실행 중인 배치 잡 |
| `SCHEDULER_JOB_FAILED` | 배치 잡 실패 |

---

## 에러 응답 형식

### Gateway (OpenAI 규격 호환)
```json
{
  "error": {
    "code": "GATEWAY_ALL_KEYS_EXHAUSTED",
    "message": "모든 LLM 키가 소진되었습니다",
    "type": "gateway_error"
  }
}
```

### Analyzer (FastAPI 기본)
```json
{
  "detail": {
    "code": "SCREENER_FETCH_FAILED",
    "message": "Yahoo Finance 데이터 수집에 실패했습니다",
    "context": { "ticker": "NVDA" }
  }
}
```

---

## 알림 기준 (Discord Webhook)

| 레벨 | 조건 | 알림 여부 |
|:---|:---|:---:|
| `INFO` | 배치 정상 완료 | 선택 |
| `WARNING` | 일부 종목 분석 실패, 재시도 중 | O |
| `ERROR` | 배치 전체 실패, 매매 실패 | O (즉시) |
| `CRITICAL` | 모든 키 소진, 브로커 인증 실패 | O (즉시) |
