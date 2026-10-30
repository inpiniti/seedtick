# Reportist AI-Gateway

OpenRouter 기반 고성능 무료 LLM 통합 게이트웨이입니다.
여러 개의 OpenRouter API 키를 하나의 OpenAI 호환 엔드포인트(`/v1/chat/completions`)로 서비스하며, 동시 요청(동접)에 대해 **유휴 키 우선(Idle-First) 및 실시간 인플라이트(In-Flight) 추적**을 통해 키 간 충돌 없이 효율적인 병렬 처리를 보장합니다.

## 주요 특징

- **단일 주력 제공사 (OpenRouter Primary)**: 빈번한 쿨다운과 지연을 유발하는 불안정한 무료 제공사 체인을 제거하고 신뢰성 높은 OpenRouter 무료 모델(`openrouter/free`)로 즉각적인 응답 제공
- **지능형 동시성 스케줄링**:
  - 각 키별 현재 처리 중인 활성 요청 수(`activeRequests`) 실시간 추적
  - 1번키 사용 중이면 2번키, 2번키 사용 중이면 3번키로 자동 배정 (등록 순서 기반 결정론적 라우팅)
  - 요청 완료 즉시 키 반환(`acquireKey` / `releaseKey`)
  - 5개~10개 이상의 다중 키 풀 확장 지원
- **422 Unprocessable Entity 에러 원천 차단**:
  - OpenRouter 내부 서브 모델 응답의 불완전한 필드(`finish_reason: null`, `usage` 누락 등)를 OpenAI 표준 규격으로 안전하게 정규화
  - Elysia 응답 검증 스키마를 유연하게 완화하여 유효한 응답 거부 방지
- **초고속 무대기 페일오버**: 429(Rate Limit) 감지 시 해당 키 60초 쿨다운 등록 후 즉시 다음 유휴 키로 투명하게 전환
- **일일 소진(RPD) 영구 추적**: Supabase 연동으로 RPD 소진 키는 자정까지 인메모리 + DB 이중 차단

## 기술 스택

- **Runtime**: Bun
- **Framework**: Elysia.js
- **Database**: Supabase (일일 소진 키 저장)
- **Deployment**: Vercel Serverless Function

## 환경 변수 설정 (`.env.local`)

```env
# AI Gateway Secret (인증 헤더: Authorization: Bearer {GATEWAY_SECRET})
GATEWAY_SECRET=your-gateway-secret

# OpenRouter 다중 API 키 (콤마 구분으로 5개~10개 이상 등록)
OPENROUTER_API_KEY=sk-or-v1-key1,sk-or-v1-key2,sk-or-v1-key3,sk-or-v1-key4,sk-or-v1-key5

# Supabase 연동 (일일 쿼터 소진 영구 기록)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 실행 및 테스트

```bash
# 개발 서버 실행
bun run dev

# 빌드
bun run build

# 단위 및 통합 테스트 실행 (KeyRotator 동시성 테스트 포함)
bun test

# 타입 검사
bun run typecheck
```

## API 엔드포인트

- `POST /v1/chat/completions`: OpenAI 규격 챗 완성 엔드포인트
- `GET /v1/youtube/audio?url=...`: YouTube URL/11자리 videoId의 오디오를 추출해 BGM용 바이너리로 반환
- `GET /health`: 헬스체크
- `GET /debug/keys`: 각 OpenRouter 키의 실시간 인플라이트(active) 요청 현황 조회
- `GET /debug/cooldown`: 현재 쿨다운 중인 키 목록 조회
- `GET /debug/quota`: 일일 소진된 키 목록 조회

### `GET /v1/youtube/audio` 참고 사항

- `Authorization: Bearer {GATEWAY_SECRET}` 헤더가 필요합니다.
- YouTube InnerTube(VISIONOS 클라이언트)로 오디오 direct URL을 얻은 뒤 게이트웨이가 대신 내려받아 중계합니다. 브라우저에서 `googlevideo.com`을 직접 호출하면 CORS 헤더가 없고 URL이 요청 IP에 묶여 실패합니다.
- Vercel 서버리스 응답 제한(4.5MB)을 피하기 위해 최대 `3,800,000` 바이트까지만 반환합니다. 포맷은 m4a(itag 140 → 139)를 우선하고, 초과 시 더 작은 포맷의 앞부분을 사용합니다.
- 응답 헤더: `X-Youtube-Title`(URL 인코딩), `X-Youtube-Duration`, `X-Youtube-Itag`, `X-Youtube-Audio-Seconds`, `X-Youtube-Truncated`, `X-Youtube-Filename`.
- YouTube 봇 체크(`LOGIN_REQUIRED`)가 발생하면 `visitorData`를 새로 발급받아 1회 재시도합니다. 계속 차단되면 `YOUTUBE_BOT_CHECK`(422)와 함께 음악 파일 직접 업로드를 안내합니다.
- 선택 설정 `YOUTUBE_COOKIE`에 Netscape 형식 `cookies.txt` 전체 내용을 넣으면 `visitorData` 재시도 후에도 봇 체크가 계속될 때만 로그인 쿠키 인증으로 한 번 더 시도합니다. 쿠키 인증은 쿠키를 지원하는 `WEB_EMBEDDED_PLAYER`로 요청하고, 갱신된 `visitorData`는 쿠키와 섞지 않습니다. `.youtube.com` 쿠키만 읽고 인증 쿠키는 YouTube 플레이어 요청에만 전달하며, 오디오 다운로드 호스트에는 전달하지 않습니다. `Set-Cookie` 응답 헤더는 입력으로 사용할 수 없습니다. 로그인 쿠키는 계정 비밀번호와 같은 비밀정보이므로 저장소에 넣지 말고 배포 환경의 환경변수로 설정해야 합니다.
- YouTube가 데이터센터/Vercel IP를 차단하면 `502` 또는 `422`와 함께 음악 파일 직접 업로드를 안내하는 메시지를 반환합니다. 이 기능은 게이트웨이를 최신 버전으로 배포해야 동작합니다.
- 저작권이 있는 음원은 권리자의 허락을 받은 경우에만 사용해야 합니다.
