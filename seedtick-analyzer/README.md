# SeedTick Analyzer

미국 주식 자동 스크리닝·13인 투자 거장 심층 분석·일일 배치 스케줄러·독립 증권사 연동 자동매매 통합 서버입니다.

## 핵심 기능

1. **[Screener] 토스증권 13인 거장 '공통' 스크리너**:
   - 미국 주식 유니버스 중 13인의 거장 합의 필터(시총 3000억↑, 부채비율 100%↓, 이자보상배율 3배↑, 영업이익률 10%↑, ROE 10%↑) 통과 종목 자동 추출
   - 1차: `BTC-AI backend` 프록시 호출, 2차: `토스 WTS 비공개 API` 직접 조회 (세션 및 심볼 보강 폴백)
2. **[Report] DataPackBuilder 사전 구축 및 13인 거장 5단계 파이프라인**:
   - `DataPackBuilder`: Yahoo Finance / SEC EDGAR / Toss 비공개 엔드포인트 연동으로 손익계산서, 현금흐름표, 밸류에이션, 수급 지표를 2초 내 고품질 데이터팩(`_data/{ticker}.md`)으로 생성
   - 13인 거장 요약 블록 병렬 생성 (`_data/{ticker}_요약.md`)
   - 거장들의 치열한 원탁 토론 전문 생성 (`최종/{ticker}_토론.md`)
   - 최종 마스터 종합 투자 보고서 생성 (`최종/{ticker}_최종보고서.md`)
   - Supabase `guru_votes` DB 동기화
3. **[Bridge] 독립 증권사 Broker Bridge Lib**:
   - 비즈니스 로직과 분리된 독립 패키지 구조 (`IBrokerAdapter`)
   - `MockBrokerAdapter`: 로컬 테스트 및 안전 검증용 시뮬레이터
   - `TossBrokerAdapter`: 토스 Open API 정본 스펙 (120ms 요청 간격, 단일 토큰 캐싱, 미국주식 가격 정정)
   - `KisBrokerAdapter`: 한국투자증권 Open API (해외주식 주문 TR: TTTT1002U, 잔고 TR)
4. **[Scheduler] 미국 증시 휴장일 가드 (`MarketCalendarGuard`)**:
   - 월~금 18:00 KST 정기 실행
   - 토/일 주말 및 미국 증시(NYSE/NASDAQ) 공식 공휴일(신정, MLK, 성금요일, 메모리얼데이, 독립기념일, 노동절, 추수감사절, 크리스마스 등) 자동 판별 및 스킵

---

## 실행 방법

### 로컬 개발 서버 실행
```bash
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

### 테스트 실행
```bash
pytest -v
```

### API 엔드포인트
- `GET /health` : 서버 상태 및 오늘 미장 개장 여부
- `GET /api/screener/run` : 토스 공통/해외 200 종목 스크리닝
- `GET /api/report/datapack/{ticker}` : 특정 종목 심층 데이터팩 단독 생성
- `POST /api/report/generate?ticker={ticker}` : 13인 거장 5단계 리포트 생성 및 DB 저장
- `POST /api/scheduler/trigger` : 일일 파이프라인 수동 즉시 트리거 (dry_run, force 플래그 지원)
