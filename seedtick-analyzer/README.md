---
title: Coin Bridge
emoji: 📈
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# SeedTick Analyzer

미국 주식 자동 스크리닝·13인 투자 거장 심층 분석·일일 배치 스케줄러·독립 증권사 연동 자동매매 통합 서버입니다.

## 핵심 기능

1. **[Screener] 토스증권 13인 거장 '공통' 스크리너**:
   - 미국 주식 유니버스 중 13인의 거장 합의 필터(시총 3000억↑, 부채비율 100%↓, 이자보상배율 3배↑, 영업이익률 10%↑, ROE 10%↑) 통과 종목 자동 추출
   - 1차: `BTC-AI backend` 프록시 호출, 2차: `토스 WTS 비공개 API` 직접 조회 (세션 및 심볼 보강 폴백)
2. **[Report] DataPackBuilder 사전 구축 및 5단계 파이프라인**:
   - `DataPackBuilder`: Yahoo Finance / SEC EDGAR / Toss 비공개 엔드포인트 연동으로 손익계산서, 현금흐름표, 밸류에이션, 수급 지표를 2초 내 고품질 데이터팩(`_data/{ticker}.md`)으로 생성
   - 13인 거장 요약 블록 병렬 생성 (`_data/{ticker}_요약.md`, 기본 출력 한도 2,048 토큰)
   - 기본 설정은 AI 원탁 토론 호출을 생략하고 요약 기반 간결 문서를 저장합니다 (`최종/{ticker}_토론.md`); 쟁점과 적정가 합의 밴드는 마스터 단계에서 직접 도출합니다
   - 최종 마스터 종합 투자 보고서 생성 (`최종/{ticker}_최종보고서.md`, 기본 출력 한도 6,144 토큰)
   - 출력이 토큰 상한에서 잘리면 상한을 2배로 높여 1회 재시도하며, 재시도도 잘리면 불완전한 보고서를 성공 결과로 반환하지 않습니다
   - Supabase `guru_votes` DB 동기화
3. **[Bridge] 독립 증권사 Broker Bridge Lib**:
   - 비즈니스 로직과 분리된 독립 패키지 구조 (`IBrokerAdapter`)
   - `MockBrokerAdapter`: 로컬 테스트 및 안전 검증용 시뮬레이터
   - `TossBrokerAdapter`: 토스 Open API 정본 스펙 (120ms 요청 간격, 단일 토큰 캐싱, 미국주식 가격 정정)
   - `KisBrokerAdapter`: 한국투자증권 Open API (해외주식 주문 TR: TTTT1002U, 잔고 TR)
4. **[Scheduler] 미국 증시 휴장일 가드 (`MarketCalendarGuard`)**:
   - 월~금 12:00 KST 정기 실행
   - 토/일 주말 및 미국 증시(NYSE/NASDAQ) 공식 공휴일(신정, MLK, 성금요일, 메모리얼데이, 독립기념일, 노동절, 추수감사절, 크리스마스 등) 자동 판별 및 스킵

---

## 실행 방법

토론을 다시 AI로 생성하려면 `.env` 또는 `.env.local`에 `ENABLE_ROUND_TABLE_DISCUSSION=true`를 설정하세요. 단계별 출력 한도는 `SUMMARY_MAX_TOKENS`, `DISCUSSION_MAX_TOKENS`, `MASTER_MAX_TOKENS`로 조정할 수 있습니다.

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
- `GET /api/ip` : 내 IP 및 서버 공인 IP 확인 (토스/한투 Open API 허용 IP 등록용)
- `GET /api/bridge/status` : 증권사 브릿지 연동 설정 및 자격증명 상태 확인
- `GET /api/bridge/balance` : 증권사 계좌 잔고(KRW, USD, 보유 포지션) 조회
- `GET /api/auto-trading/status` : 오토트레이딩 금일 주문 현황 및 일일 한도 상태 조회
- `GET /api/screener/run` : 토스 공통/해외 200 종목 스크리닝
- `GET /api/screener/roma` : DataRoma 슈퍼인베스터 그랜드 포트폴리오 스크리닝 (보유자 10명 이상, 두번째 스크리너)
- `GET /api/report/datapack/{ticker}` : 특정 종목 심층 데이터팩 단독 생성
- `POST /api/report/generate?ticker={ticker}` : 13인 거장 5단계 리포트 생성 및 DB 저장
- `POST /api/scheduler/trigger` : 일일 파이프라인 수동 즉시 트리거 (백그라운드 실행 후 즉시 응답, dry_run·force 플래그 지원)
- `GET /api/scheduler/progress` : 13인 거장 파이프라인 실시간 진행 상태 (단계, n/총, n/13, 경과 시간)

