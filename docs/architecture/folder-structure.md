# 프로젝트 폴더 구조

## seedtick-ai-gateway (Elysia + Bun → Vercel)

```
seedtick-ai-gateway/
├── src/
│   ├── index.ts                   # Bun.serve() 엔트리포인트
│   ├── app.ts                     # Elysia 앱 인스턴스
│   ├── routes/
│   │   ├── chat.ts                # POST /v1/chat/completions
│   │   └── health.ts              # GET /health
│   ├── domain/
│   │   ├── key-rotator/
│   │   │   ├── KeyRotator.ts      # 핵심 도메인 로직: 키 로테이션
│   │   │   ├── KeyPool.ts         # 키 풀 관리 (값 객체)
│   │   │   └── types.ts           # LLMProvider, ApiKey 타입
│   │   └── proxy/
│   │       ├── ProxyService.ts    # LLM 요청 프록시
│   │       └── adapters/
│   │           ├── GeminiAdapter.ts
│   │           ├── OpenAIAdapter.ts
│   │           └── ILLMAdapter.ts # 어댑터 인터페이스
│   ├── middleware/
│   │   ├── auth.ts                # Bearer 토큰 검증
│   │   └── error-handler.ts
│   └── config/
│       └── env.ts                 # 환경변수 타입 안전 로드
├── tests/
│   ├── key-rotator.test.ts
│   └── proxy.test.ts
├── .env.example
├── bunfig.toml
├── tsconfig.json
├── biome.json                     # 린트/포맷
└── vercel.json
```

## seedtick-analyzer (FastAPI + Python → HuggingFace)

```
seedtick-analyzer/
├── app/
│   ├── main.py                    # FastAPI 앱 + APScheduler 수명주기
│   ├── api/
│   │   ├── routes/
│   │   │   ├── screener.py        # GET /screener/run (거장 공통 스크리닝)
│   │   │   ├── report.py          # POST /report/generate (5단계 파이프라인)
│   │   │   ├── scheduler.py       # POST /scheduler/trigger (수동 트리거)
│   │   │   └── health.py          # GET /health
│   │   └── dependencies.py        # DI: supabase client, bridge 등
│   │
│   ├── domains/
│   │   ├── screener/
│   │   │   ├── service.py         # ScreenerService (1차 BTC-AI, 2차 WTS 폴백)
│   │   │   ├── models.py          # TossStockItem, ScreenCriteria
│   │   │   └── clients/
│   │   │       ├── btc_ai_toss.py # bitcoin-ai-backend 토스 프록시 클라이언트
│   │   │       └── toss_wts.py    # 토스 WTS 직접 통신 (폴백 세션 관리)
│   │   │
│   │   ├── report/
│   │   │   ├── service.py         # GuruReportService (5단계 파이프라인)
│   │   │   ├── models.py          # StockDataPack, GuruSummaryDoc, FinalMasterReport
│   │   │   ├── datapack_builder.py# [사전구축] Yahoo/SEC/Toss 정량 데이터팩 생성기
│   │   │   ├── personas/          # 13인의 거장 시스템 프롬프트 정의
│   │   │   ├── discussion_engine.py # 거장 상호 반박 토론 생성기
│   │   │   └── ai_client.py       # AI-Gateway 호출 클라이언트 (멀티키 로테이션 연동)
│   │   │
│   │   ├── scheduler/
│   │   │   ├── service.py         # SchedulerService (월~금 18:00 APScheduler)
│   │   │   ├── market_guard.py    # 주말 및 미국 증시(NYSE) 공휴일 스킵 가드
│   │   │   ├── jobs.py            # daily_pipeline 일일 배치 정의
│   │   │   └── models.py          # JobStatus, TriggerResult
│   │   │
│   │   ├── auto_trading/
│   │   │   ├── service.py         # AutoTradingService
│   │   │   ├── models.py          # TradeOrder, TradeResult, Position
│   │   │   ├── order_manager.py   # 일일 10만원 한도 및 중복 방지
│   │   │   └── strategies/
│   │   │       └── guru_consensus.py # g0==0 종합 매수 종목 소액 분할 발주
│   │   │
│   │   ├── bridge/                # 독립 증권사 연동 라이브러리
│   │   │   ├── interface.py       # IBrokerAdapter (공통 인터페이스)
│   │   │   ├── models.py          # BrokerOrder, BrokerBalance, OrderResult
│   │   │   ├── factory.py         # get_broker_adapter("toss"|"kis"|"mock")
│   │   │   └── adapters/
│   │   │       ├── toss.py        # 토스증권 Open API (120ms 간격, 가격 정정)
│   │   │       ├── kis.py         # 한국투자증권 해외주식 Open API
│   │   │       └── mock.py        # 로컬 테스트 및 dry-run용 가상 어댑터
│   │   │
│   │   └── error_log/
│   │       ├── service.py         # ErrorLogService
│   │       ├── models.py          # ErrorEvent, AlertLevel
│   │       └── notifiers/
│   │           └── discord.py     # Discord 웹훅 (파이프라인 요약 및 긴급 장애)
│   │
│   ├── infrastructure/
│   │   ├── supabase_repo.py       # guru_votes 및 report DB 동기화
│   │   └── http_client.py         # httpx 비동기 클라이언트
│   │
│   └── config/
│       ├── settings.py            # pydantic-settings 환경변수
│       └── constants.py           # 안전 한도(10만원), 시간 상수
│
├── tests/
│   ├── domains/
│   │   ├── test_screener.py
│   │   ├── test_datapack_builder.py
│   │   ├── test_market_guard.py
│   │   ├── test_bridge.py
│   │   └── test_report.py
│   └── conftest.py
│
├── .env.example
├── requirements.txt
├── pyproject.toml                 # ruff 린트 설정
├── Dockerfile                     # HuggingFace 배포용
└── README.md
```

## docs/ (이 저장소)

```
docs/
├── README.md
├── architecture/
├── contract/
├── rules/
└── domains/
```
