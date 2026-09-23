# Report 함수 명세

## ReportService

### `generate(ticker: str) -> Report`

메인 리포트 생성 함수.

**흐름**:
1. `_fetch_metrics(ticker)` — 재무 데이터 수집
2. `prompt_builder.build(metrics, personas)` — 페르소나별 프롬프트 생성
3. `ai_client.chat(prompt)` — AI-Gateway 호출 (에러 시 `REPORT_AI_FAILED`)
4. `_parse_response(response)` — 응답 파싱 (실패 시 `REPORT_PARSE_FAILED`)
5. `_aggregate_verdict(persona_votes)` — 최종 verdict/confidence 계산
6. Supabase에 저장

**중복 처리**:
- 이미 해당 날짜 리포트 존재 시 `REPORT_ALREADY_EXISTS` 에러

---

## PromptBuilder

### `build(metrics: FinancialMetrics, personas: list[str]) -> str`

페르소나별 분석 프롬프트 조립.

모든 페르소나를 하나의 프롬프트에 포함 (API 호출 1회).

---

## AiClient

### `chat(prompt: str) -> str`

AI-Gateway에 OpenAI 규격으로 요청.

**설정**:
```python
AI_GATEWAY_URL = settings.AI_GATEWAY_URL
DEFAULT_MODEL = "gemini-pro"
TIMEOUT_SECONDS = 30
```

---

## verdict 집계 알고리즘

```python
def aggregate_verdict(votes: list[PersonaVote]) -> tuple[str, int]:
    """
    Returns: (verdict, confidence 0-100)
    
    BUY: BUY 비율 >= 50% AND 평균 확신도 >= 6
    SELL: SELL 비율 >= 40%
    HOLD: BUY 있으나 확신도 낮음
    WATCH: 나머지
    """
    buy_ratio = sum(1 for v in votes if v.verdict == "BUY") / len(votes)
    sell_ratio = sum(1 for v in votes if v.verdict == "SELL") / len(votes)
    avg_confidence = sum(v.confidence for v in votes) / len(votes)
    confidence_100 = int(avg_confidence * 10)

    if sell_ratio >= 0.4:
        return "SELL", confidence_100
    elif buy_ratio >= 0.5 and avg_confidence >= 6:
        return "BUY", confidence_100
    elif buy_ratio > 0:
        return "HOLD", confidence_100
    else:
        return "WATCH", confidence_100
```
