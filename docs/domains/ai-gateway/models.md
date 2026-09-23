# AI-Gateway 지원 모델 목록

## 주력 모델: inclusionai/ling-3.0-flash-fin:free

금융 및 투자 분석에 특화된 고성능 무료 모델로, 13인의 투자 거장 페르소나 분석, 원탁 토론, 마스터 투자 보고서 작성에 최적화되어 있습니다.

| 모델 ID | 특징 | 제공사 폴백 순서 |
|:---|:---|:---|
| `inclusionai/ling-3.0-flash-fin:free` | 금융·재무 특화 무료 LLM | 1. OpenRouter → 2. Cline → 3. Kilo |

**OpenRouter 필수 헤더**:
```http
HTTP-Referer: https://seedtick.app
X-Title: SeedTick
```

---

## FIFO 순환 큐 (Circular Queue) 기반 키 로테이션

특정 1번 키에만 요청이 편중되는 병목을 방지하기 위해 **FIFO 순환 큐** 방식으로 키를 관리합니다:
1. 큐의 맨 앞(Head)에 있는 유휴 키를 꺼내어 요청을 수행합니다.
2. 요청 시작(`acquireKey`) 및 완료(`releaseKey`) 시 해당 키를 **큐의 맨 마지막(Tail)에 집어넣습니다**.
3. 따라서 10개 이상의 요청이 동시에 또는 연속으로 발생해도 1번키 → 2번키 → 3번키 ... N번키 순으로 고르게 순환 분산됩니다.

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
