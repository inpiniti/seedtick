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
