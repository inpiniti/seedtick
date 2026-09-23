# AI-Gateway 지원 모델 목록

## 주력 제공사: OpenRouter (Primary)

**Base URL**: `https://openrouter.ai/api/v1/chat/completions`  
**인증**: `Authorization: Bearer {OPENROUTER_API_KEY}`  
**응답 규격**: OpenAI 호환 (게이트웨이 어댑터에서 완벽 정규화)

| 모델 ID | 특징 | 권장 사용처 |
|:---|:---|:---|
| `openrouter/free` | 실시간 가용한 최적 무료 모델 자동 선택 | 종목 심층 분석, 거장 토론, 리포트 생성 등 |

**필수 헤더**:
```http
HTTP-Referer: https://seedtick.app
X-Title: SeedTick
```

---

## 키 풀 및 동시성 라우팅

OpenRouter API 키를 5개~10개 이상 등록하여 키 풀을 형성합니다.
요청 유입 시 **유휴 키(현재 요청을 처리하고 있지 않은 키)**를 1번키부터 차례대로 탐색하여 배정합니다.

```
[Key 1] (Active: 0) ← 1차 단독 요청 배정
[Key 2] (Active: 0) ← 동시 요청 발생 시 2차 배정
[Key 3] (Active: 0) ← 3개 동접 발생 시 3차 배정
...
[Key N]
```

- **429(Rate Limit) 발생 시**: 해당 키는 60초 쿨다운에 들어가며, 즉시 다음 유휴 키로 전환되어 클라이언트는 지연을 느끼지 못합니다.
- **응답 보정**: 서브 모델마다 다른 `finish_reason`이나 `usage`를 OpenAI 규격으로 안전하게 정규화하여 422 에러를 방지합니다.

---

## 환경변수 설정

`.env.local` 또는 배포 환경변수에 콤마로 연결하여 등록:

```bash
# OpenRouter 다중 키 (5개~10개 이상 권장)
OPENROUTER_API_KEY=sk-or-v1-xxx1,sk-or-v1-xxx2,sk-or-v1-xxx3,sk-or-v1-xxx4,sk-or-v1-xxx5

# 게이트웨이 시크릿 및 Supabase (필수)
GATEWAY_SECRET=your-secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```
