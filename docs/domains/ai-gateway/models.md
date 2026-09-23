# AI-Gateway 지원 모델 목록

## 제공사별 모델 상세

---

### Cline (OpenRouter 경유 무료 모델)

**Base URL**: `https://api.cline.bot/v1/chat/completions`  
**인증**: `Authorization: Bearer {CLINE_API_KEY}`  
**응답 규격**: OpenAI 호환

| 모델 ID | 특징 | 추천 사용처 |
|:---|:---|:---|
| `cline-free/deepseek-v4.1-flash` | 코드 이해/생성 최고 | 분석, 리포트 생성 |
| `cline-free/mimo-v2.6-flash` | 범용, 빠른 응답 | 일반 분석 |
| `cline-free/muse-spark-1.3-contributor` | 창의적 분석, 투자 논거 | 페르소나 분석 |
| `cline-free/solar-pro4` | 한국어 강점 | 한국어 요약 생성 |

**모델 내 폴백 순서**: deepseek → mimo → muse → solar

**에러 특이사항**:
- 키당 모든 모델 소진 시 다음 키로 이동
- `cline-free` 접두사 모델이 정책 변경으로 404가 발생하면 24시간 skip

---

### Kilo

**Base URL**: `https://api.kilo.ai/v1/chat/completions`  
**인증**: `Authorization: Bearer {KILO_API_KEY}`  
**응답 규격**: OpenAI 호환

| 모델 ID | 특징 |
|:---|:---|
| `kilo-auto/free` | 자동으로 최적 무료 모델 선택 |

**특이사항**: 모델 1개이므로 키만 순환

---

### OpenRouter

**Base URL**: `https://openrouter.ai/api/v1/chat/completions`  
**인증**: `Authorization: Bearer {OPENROUTER_API_KEY}`  
**응답 규격**: OpenAI 호환

| 모델 ID | 특징 |
|:---|:---|
| `openrouter/free` | 그날 가용한 최선 무료 모델 자동 선택 |

**추가 헤더 필요**:
```http
HTTP-Referer: https://seedtick.app
X-Title: SeedTick
```

---

### Gemini (Google)

**Base URL**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`  
**인증**: `?key={GEMINI_API_KEY}` (URL 쿼리)  
**응답 규격**: Gemini 고유 → **어댑터에서 OpenAI 규격으로 변환 필요**

| 모델 ID | RPD | TPD | 특징 |
|:---|:---:|:---:|:---|
| `gemini-3.5-flash-lite` | 500 | 많음 | 경량, 빠름, 높은 일일 한도 |
| `gemini-3.1-flash-lite` | 500 | 많음 | 한도 백업용 |

**모델 내 폴백 순서**: 3.5-flash-lite → 3.1-flash-lite

**특이사항**:
- 할당량 리셋: **태평양 자정** (UTC 08:00, 동절기 07:00)
- RPD 500이 높아 다른 제공사 소진 후 최후 안전망 역할
- Gemini 특유 SSE 응답 → OpenAI 규격 변환 어댑터 필요

---

## 모델 순위 및 전체 폴백 체인

```
우선순위 낮음 ←────────────────────────────────→ 우선순위 높음

Gemini(백업)  OpenRouter  Kilo  Cline(1순위)
   │               │        │         │
   │               │        │    deepseek-v4.1
   │               │        │    mimo-v2.6
   │               │        │    muse-spark-1.3
   │               │        │    solar-pro4
   3.5-lite     auto      auto         │
   3.1-lite                         모든 키 순환
```

> Cline을 1순위로 두는 이유: 코딩/분석 특화 모델이 다양하며, 무료 티어 한도가 상대적으로 넉넉합니다.

---

## 환경변수 설정

```bash
# 콤마 구분으로 여러 키 설정
CLINE_API_KEY=key1,key2,key3
KILO_API_KEY=key1,key2
OPENROUTER_API_KEY=key1,key2
GEMINI_API_KEY=key1,key2,key3,key4
```
