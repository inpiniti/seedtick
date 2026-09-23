# AI-Gateway 도메인 개요

## 역할

OpenRouter를 주력(Primary)으로 하는 무료 LLM API 게이트웨이로서, 복수의 API 키를 단일 OpenAI 규격 엔드포인트(`/v1/chat/completions`)로 통합 제공합니다.
동시 요청(동접) 유입 시 **유휴 키 우선(Idle-First) 및 실시간 인플라이트(In-Flight) 추적**을 통해 키 간 충돌 없이 병렬 처리하며, 429 레이트리밋 발생 시 즉시 다음 가용 키로 전환합니다. 일일 소진 키는 Supabase에 기록해 불필요한 재시도를 방지합니다.

## 핵심 기능

1. **지능형 동시성 제어 (In-Flight Concurrency Tracking)**
   - 등록된 키별 현재 처리 중인 활성 요청 수(`activeRequests`)를 실시간 추적
   - 1번키가 사용 중이면 자동으로 2번키, 2번키도 사용 중이면 3번키로 할당
   - 요청 완료(`releaseKey`) 시 즉시 유휴 상태로 복귀하여 다음 요청 우선 할당
   - 5개~10개 이상의 다중 키 풀 확장 지원
2. **응답 스키마 정규화 & 422 에러 원천 차단**
   - OpenRouter 내부의 다양한 서브 모델 응답(finish_reason null, usage 누락 등)을 완벽한 OpenAI 규격으로 안전하게 정규화
   - Elysia 응답 검증을 완화하여 유효한 응답의 422 Unprocessable Entity 에러 방지
3. **무대기 즉시 페일오버 (Failover)**
   - 429(Rate Limit), 쿨다운 발생 시 지연 없이 다음 유휴 키로 즉시 재시도

## 주력 서비스 및 모델

| 제공사 | 모델 ID | 설명 |
|:---|:---|:---|
| **OpenRouter** (Primary) | `openrouter/free` | 실시간 최적 무료 LLM 자동 라우팅 (Gemini, Llama, DeepSeek 등) |
| *기타 (Optional)* | 환경변수 등록 시에만 어댑터 활성화 | 백업 용도 |

## 키 할당 및 동접 처리 전략

```
요청 유입
  ├─ 1. 가용 키 목록 조회 (쿨다운 X, 일일소진 X)
  ├─ 2. 미사용 키(active == 0) 중 등록 순서(1번 → 2번 → 3번 ...) 우선 할당
  │    └─ 예: 1번키 사용 중일 때 → 2번키 할당하여 병렬 실행
  ├─ 3. 키 점유(acquireKey) 후 LLM API 호출
  │    ├─ 성공: OpenAI 규격 정규화 응답 반환 & 키 반환(releaseKey)
  │    └─ 429/에러: 해당 키 쿨다운 등록 & 키 반환 & 즉시 다음 가용 키 재시도
  └─ 4. 모든 키 소진 시: 503 GATEWAY_ALL_EXHAUSTED 반환
```

## 관련 문서

- [지원 모델 목록](./models.md)
- [에러 처리 전략](./error-handling.md)
- [키 소진 관리 (Supabase)](./quota-management.md)
- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
- [API 스펙](../../contract/api-spec.md)
