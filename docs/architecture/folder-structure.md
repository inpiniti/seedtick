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
│   ├── main.py                    # FastAPI 앱 + APScheduler 초기화
│   ├── api/
│   │   ├── routes/
│   │   │   ├── screener.py        # GET /screener/run
│   │   │   ├── report.py          # POST /report/generate
│   │   │   ├── scheduler.py       # POST /scheduler/trigger (수동 트리거)
│   │   │   └── health.py          # GET /health
│   │   └── dependencies.py        # DI: supabase client, bridge 등
│   │
│   ├── domains/
│   │   ├── screener/
│   │   │   ├── service.py         # ScreenerService
│   │   │   ├── models.py          # Ticker, ScreenCriteria (Pydantic)
│   │   │   ├── filters.py         # 필터링 알고리즘
│   │   │   └── sources/
│   │   │       ├── yahoo.py       # Yahoo Finance 데이터 소스
│   │   │       └── base.py        # IStockDataSource 인터페이스
│   │   │
│   │   ├── report/
│   │   │   ├── service.py         # ReportService
│   │   │   ├── models.py          # Report, Verdict, Persona (Pydantic)
│   │   │   ├── prompt_builder.py  # LLM 프롬프트 조립
│   │   │   └── ai_client.py       # AI-Gateway 호출 (OpenAI 규격)
│   │   │
│   │   ├── scheduler/
│   │   │   ├── service.py         # SchedulerService (APScheduler 래퍼)
│   │   │   ├── jobs.py            # 일일 배치 잡 정의
│   │   │   └── models.py          # JobStatus, TriggerResult
│   │   │
│   │   ├── auto_trading/
│   │   │   ├── service.py         # AutoTradingService
│   │   │   ├── models.py          # TradeOrder, TradeResult, Position
│   │   │   ├── order_manager.py   # 중복 주문 방지, 한도 관리
│   │   │   └── strategies/
│   │   │       ├── base.py        # IOrderStrategy
│   │   │       └── market_open.py # 장 시작 예약 전략
│   │   │
│   │   ├── bridge/
│   │   │   ├── interface.py       # IBrokerAdapter (공통 인터페이스)
│   │   │   ├── models.py          # BrokerOrder, BrokerBalance
│   │   │   └── adapters/
│   │   │       ├── toss.py        # 토스증권 어댑터
│   │   │       └── kis.py         # 한국투자증권 어댑터
│   │   │
│   │   └── error_log/
│   │       ├── service.py         # ErrorLogService
│   │       ├── models.py          # ErrorEvent, AlertLevel
│   │       └── notifiers/
│   │           ├── discord.py     # Discord 웹훅
│   │           └── base.py        # INotifier
│   │
│   ├── infrastructure/
│   │   ├── supabase_client.py     # Supabase 연결
│   │   └── http_client.py         # httpx 공통 클라이언트
│   │
│   └── config/
│       ├── settings.py            # pydantic-settings 환경변수
│       └── constants.py           # 한도, 시간 상수
│
├── tests/
│   ├── domains/
│   │   ├── test_screener.py
│   │   ├── test_report.py
│   │   ├── test_auto_trading.py
│   │   └── test_bridge.py
│   └── conftest.py
│
├── .env.example
├── requirements.txt
├── pyproject.toml                 # ruff 린트 설정
├── Dockerfile
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
