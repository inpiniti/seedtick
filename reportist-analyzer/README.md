---
title: Coin Bridge
emoji: 📈
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Reportist Analyzer

미국 주식 자동 스크리닝·13인 투자 거장 심층 분석·일일 배치 스케줄러 통합 분석 서버입니다.

## 핵심 기능

1. **[Screener] 토스증권 13인 거장 '공통' 스크리너 & DataRoma 슈퍼인베스터 스크리너**:
   - 미국 주식 유니버스 중 13인의 거장 합의 필터(시총 3000억↑, 부채비율 100%↓, 이자보상배율 3배↑, 영업이익률 10%↑, ROE 10%↑) 통과 종목 자동 추출
   - DataRoma 슈퍼인베스터 포트폴리오(보유자 10명 이상) 중복 제거 병합
   - 토스 WTS 비공개 API 기반 종목명, 로고 캐싱 워밍업
2. **[Report] DataPackBuilder 사전 구축 및 4단계 심층 분석 파이프라인**:
   - `DataPackBuilder`: Yahoo Finance / SEC EDGAR / Toss 연동으로 손익계산서, 현금흐름표, 밸류에이션, 수급 지표를 고품질 데이터팩으로 생성
   - 13인 거장 요약 블록 병렬 생성 (워런 버핏, 찰리 멍거, 피터 린치 등)
   - 최종 마스터 종합 투자 보고서 생성 및 내재가치/안전마진 산출
   - Supabase `guru_reports`, `guru_opinions`, `guru_votes` DB 동기화
3. **[Scheduler] 미국/한국 증시 휴장일 가드 (`MarketCalendarGuard`)**:
   - 월~금 12:00 KST 정기 실행
   - 토/일 주말 및 미국 증시(NYSE/NASDAQ) 공식 공휴일(신정, MLK, 성금요일, 메모리얼데이, 독립기념일, 노동절, 추수감사절, 크리스마스 등) 자동 판별 및 스킵

---

## 실행 방법

AI 출력 토큰 상한은 `AI_GATEWAY_MAX_TOKENS`로 조정할 수 있습니다.

### 로컬 개발 서버 실행
```bash
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

### 테스트 실행
```bash
pytest -v
```

- `GET /health` : 서버 상태 및 오늘 미장 개장 여부
- `GET /api/ip` : 내 IP 및 서버 공인 IP 확인
- `GET /api/screener/run` : 토스 공통/해외 200 종목 스크리닝
- `GET /api/screener/roma` : DataRoma 슈퍼인베스터 그랜드 포트폴리오 스크리닝 (보유자 10명 이상, 두번째 스크리너)
- `GET /api/report/datapack/{ticker}` : 특정 종목 심층 데이터팩 단독 생성
- `POST /api/report/generate?ticker={ticker}` : 13인 거장 4단계 리포트 생성 및 DB 저장
- `POST /api/scheduler/trigger` : 일일 파이프라인 수동 즉시 트리거 (백그라운드 실행 후 즉시 응답, dry_run·force 플래그 지원)
- `GET /api/scheduler/progress` : 13인 거장 파이프라인 실시간 진행 상태 (단계, n/총, n/13, 경과 시간, 단계별 소요 시간)

### YouTube 오디오 작업자

`GET /internal/youtube/audio?url={videoId}`는 YouTube 오디오를 최대 3,800,000바이트까지 가져옵니다. 이 경로는 공개 API가 아니며, 요청에 `Authorization: Bearer {YOUTUBE_WORKER_SECRET}`가 필요합니다.

- Analyzer 배포 환경의 Secret에 `YOUTUBE_WORKER_SECRET`을 설정하고, AI Gateway에는 같은 값을 `YOUTUBE_ANALYZER_SECRET`으로 설정합니다.
- AI Gateway의 `YOUTUBE_ANALYZER_URL`에는 Analyzer의 공개 HTTPS 주소를 설정합니다. 값이 설정되면 게이트웨이는 오디오 추출을 Analyzer에 위임합니다.
- `YOUTUBE_COOKIE`는 선택 사항입니다. 우선 쿠키 없이 요청하고, 추출이 실패하면 설정된 쿠키로 재시도합니다. Netscape `cookies.txt` 전체 내용이나 `Cookie` 요청 헤더 값을 사용할 수 있습니다. 쿠키는 Analyzer의 배포 Secret에만 저장하고 로그나 저장소에 넣지 마세요.
- yt-dlp는 현재 기본 플레이어 클라이언트를 사용하며, JavaScript 챌린지 처리를 위해 Node.js 22 런타임을 포함합니다.
- Analyzer의 외부 IP도 YouTube에서 차단될 수 있으므로, 배포 후 이 엔드포인트에서 실제 추출이 되는지 확인해야 합니다.
