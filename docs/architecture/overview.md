# 전체 시스템 아키텍처

## 1. 시스템 개요

```
[매일 18:00 KST 트리거]
        |
        v
[seedtick-analyzer: Scheduler]
        |
        +---> [Screener] 미국 주식 스크리닝 리스트 생성
        |
        +---> [Report] 각 종목에 대해:
        |       |
        |       +---> [AI-Gateway] LLM 분석 요청 (OpenAI 스펙)
        |       |         |
        |       |     [Gemini / OpenAI / Claude 등 키 로테이션]
        |       |
        |       +---> 최종 리포트 생성 (매수/매도/관망 판단)
        |
        +---> [Supabase] 리포트 저장
        |
        +---> [Auto-Trading] 리포트 기반 자동매매 예약
                |
                +---> [Bridge] 증권사 어댑터 (토스, 한투 등)
                        |
                    [장 시작 예약 매매]


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
- **역할**: 스크리닝 + 분석 + 스케줄 + 자동매매 통합
- **내부 서브도메인**:
  - `screener` — 미장 종목 필터링
  - `report` — AI 연동 분석 리포트 생성
  - `scheduler` — 일일 배치 트리거 (APScheduler)
  - `auto-trading` — 리포트 기반 매매 실행
  - `bridge` — 증권사 API 어댑터 (라이브러리)
  - `error-log` — 에러 수집/알림

## 3. 데이터 흐름

```
[18:00 KST] scheduler 트리거
    → screener.get_us_stock_list() → List[Ticker]
    → for ticker in list:
        → report.generate(ticker) 
            → ai_gateway.chat(prompt)
            → Report 객체 생성
        → supabase.save(report)
    → auto_trading.execute_from_reports(reports)
        → bridge.place_order(ticker, action, amount)
    → error_log.notify_if_any()
```

## 4. 핵심 설계 원칙

1. **Contract First** — 서비스 간 인터페이스를 먼저 확정하고 구현
2. **Fail Safe** — 매매 실패 시 재시도 없이 로그 기록 + 알림
3. **Idempotent Orders** — 동일 종목 중복 주문 방지 (일일 1회 제한)
4. **Hard Limits** — 일일 최대 매매 금액 코드 레벨에서 강제
5. **Paper First** — 실거래 전 paper-trading 모드 검증 필수
