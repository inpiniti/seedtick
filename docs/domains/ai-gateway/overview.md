# AI-Gateway 도메인 개요

## 역할

Cline, Kilo, OpenRouter, Gemini 등 여러 무료 LLM API를 하나의 OpenAI 규격 엔드포인트로 통합합니다.
에러 발생 시 **대기 없이 즉시** 다음 모델/키/제공사로 폴백하며, 일일 소진 키는 Supabase에 기록해 당일 재시도를 방지합니다.

## 지원 무료 서비스 및 모델

| 제공사 | 모델 ID | RPD(일일) | RPM(분당) | 특이사항 |
|:---|:---|:---:|:---:|:---|
| **Cline** | `cline-free/deepseek-v4.1-flash` | 제한 | 제한 | 코딩 최적화 |
| Cline | `cline-free/mimo-v2.6-flash` | 제한 | 제한 | 범용 |
| Cline | `cline-free/muse-spark-1.3-contributor` | 제한 | 제한 | 창작/분석 |
| Cline | `cline-free/solar-pro4` | 제한 | 제한 | 한국어 강점 |
| **Kilo** | `kilo-auto/free` | 제한 | 제한 | 자동 라우팅 |
| **OpenRouter** | `openrouter/free` | 제한 | 제한 | 자동 최선 모델 선택 |
| **Gemini** | `gemini-3.5-flash-lite` | 500 | - | 경량 최고 성능 |
| Gemini | `gemini-3.1-flash-lite` | 500 | - | 할당량 백업 |

## 폴백 순서 전략

```
Cline 모델 순회 (deepseek → mimo → muse → solar)
  └ 현재 키로 모든 모델 소진 시 → 다음 Cline 키
      └ 모든 Cline 키 소진 시 → Kilo 키 순회
          └ 모든 Kilo 키 소진 시 → OpenRouter 키 순회
              └ 모든 OpenRouter 키 소진 시 → Gemini 모델/키 순회
```

> **원칙**: 같은 제공사 내에서는 모델 먼저 → 키 변경 순서로 폴백

## 관련 문서

- [지원 모델 목록](./models.md)
- [에러 처리 전략](./error-handling.md)
- [키 소진 관리 (Supabase)](./quota-management.md)
- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
- [API 스펙](../../contract/api-spec.md)
