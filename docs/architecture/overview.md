# 전체 시스템 아키텍처

## 1. 시스템 개요

```
[매일 18:00 KST 트리거]
        |
        v
[seedtick-analyzer: Scheduler]
        |
        +---> [휴장일 가드] 주말 및 미국 증시(NYSE) 공휴일 스킵 검사
        |
        +---> [Screener] 토스 13인 거장 '공통' 필터 (nation=us, size=200)
        |
        +---> [Guru-Report] 스크리닝 상위 종목별 5단계 파이프라인:
        |       |
        |       +---> [1단계] DataPackBuilder (Yahoo/SEC/Toss 팩트 수집)
        |       |         └─ docs/report/{date}/_data/{ticker}.md
        |       +---> [2단계] AI-Gateway (13인 거장 요약 블록 병렬 생성)
        |       |         └─ docs/report/{date}/_data/{ticker}_요약.md
        |       +---> [3단계] 거장 원탁 토론 전문 생성
        |       |         └─ docs/report/{date}/최종/{ticker}_토론.md
        |       +---> [4단계] 최종 마스터 투자 보고서 생성
        |       |         └─ docs/report/{date}/최종/{ticker}_최종보고서.md
        |       +---> [5단계] Supabase DB 동기화 (guru_votes 테이블 기록)
        |
        +---> [Auto-Trading] 종합 매수(g0==0) 및 확신도 상위 종목 매매 실행
                |
                +---> [Bridge] 독립 증권사 어댑터 Lib (토스/한투/Mock)
                        |
                    [시장가 소액 분할 발주]


[seedtick-ai-gateway - Vercel]
  - Gemini, OpenAI, Anthropic 등 멀티키 로테이션
  - OpenAI 응답 규격으로 통일 출력
  - 에러 시 다음 키로 즉시 전환 (대기 없음)
```

## 2. 서비스 경계

### seedtick-ai-gateway (Vercel)
- **역할**: LLM 프록시 + 키 로테이션
- **입력**: OpenAI 규격 요청 (`/v1/chat/completions`)
- **출력**: OpenAI 규격 응답
- **지원 모델**: Gemini Pro, GPT-4o-mini, Claude Haiku 등
- **로직**: 에러(429, 500) 발생 시 즉시 다음 키로 전환, 대기 없음

### seedtick-analyzer (HuggingFace)
- **역할**: 스크리닝 + 13인 거장 분석 + 스케줄 + 자동매매 통합 서버
- **내부 서브도메인 & 모듈**:
  - `screener` — 토스 거장 공통 필터(해외 200개) 스크리닝
  - `report` — DataPackBuilder + 13인 거장 심층 리포트 파이프라인
  - `scheduler` — APScheduler 배치 (월~금 18:00 KST, 미장 휴장일 가드)
  - `auto-trading` — 리포트 기반 소액(10만원 미만) 분할 자동매매
  - `bridge` — 독립 증권사 어댑터 라이브러리 (토스, 한투, Mock)
  - `error-log` — 에러 수집 및 Discord 알림

## 3. 데이터 흐름

```
[18:00 KST] scheduler 트리거
    → market_guard.is_market_open(today) 검사 (주말/공휴일 시 조기 종료)
    → screener.get_stock_list() → 통과 종목 리스트 반환
    → for ticker in targets:
        → [1단계] DataPackBuilder.build(ticker) → _data/{ticker}.md
        → [2단계] 13인 거장 요약 블록 생성 → _data/{ticker}_요약.md
        → [3단계] 거장 원탁 토론 전문 생성 → 최종/{ticker}_토론.md
        → [4단계] 최종 종합 투자 보고서 생성 → 최종/{ticker}_최종보고서.md
        → [5단계] Supabase guru_votes DB 테이블 저장
    → auto_trading.execute_from_reports(reports)
        → broker_bridge.place_order(order)
    → discord_notifier.send_pipeline_summary()
```

## 4. 핵심 설계 원칙

1. **Contract First** — 서비스 간 인터페이스를 먼저 확정하고 구현
2. **Fail Safe** — 매매 실패 시 재시도 없이 로그 기록 + 알림
3. **Idempotent Orders** — 동일 종목 중복 주문 방지 (일일 1회 제한)
4. **Hard Limits** — 일일 최대 매매 금액 코드 레벨에서 강제
5. **Paper First** — 실거래 전 paper-trading 모드 검증 필수
