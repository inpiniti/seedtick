# 전체 시스템 아키텍처

## 1. 시스템 개요

```
[매일 12:00 KST 트리거]
        |
        v
[reportist-analyzer: Scheduler]
        |
        +---> [휴장일 가드] 주말 및 미국 증시(NYSE) 공휴일 스킵 검사
        |
        +---> [Screener] 토스 13인 거장 '공통' 필터 (nation=us, size=200)
        |
        +---> [Screener-Roma] DataRoma 그랜드 포트폴리오 (슈퍼인베스터 보유자 10명 이상)
        |         └─ 토스 통과 종목과 중복 티커 제거 후 분석 대상에 병합
        |
        +---> [Guru-Report] 스크리닝 상위 종목별 4단계 파이프라인:
        |       |
        |       +---> [1단계] DataPackBuilder (Yahoo/SEC/Toss 팩트 수집)
        |       |         └─ Supabase guru_reports.datapack
        |       +---> [2단계] AI-Gateway (13인 거장 요약 블록 병렬 생성)
        |       |         └─ Supabase guru_opinions
        |       +---> [3단계] 최종 마스터 투자 보고서 생성
        |       |         └─ Supabase guru_reports.final_report
        |       +---> [4단계] Supabase DB 동기화 (guru_reports, guru_opinions, guru_votes)
        |
        +---> [Discord 알림] 일일 파이프라인 완료 및 스크리닝/리포트 요약 전송


[reportist-ai-gateway - Vercel]
  - Gemini, OpenAI, Anthropic 등 멀티키 로테이션
  - OpenAI 응답 규격으로 통일 출력
  - 에러 시 다음 키/모델로 즉시 전환
```

## 2. 서비스 경계

### reportist-ai-gateway (Vercel)
- **역할**: LLM 프록시 + 키/모델 로테이션
- **입력**: OpenAI 규격 요청 (`/v1/chat/completions`)
- **출력**: OpenAI 규격 응답
- **지원 모델**: OpenRouter 무료 모델 풀 및 상위 LLM
- **로직**: 에러(429, 500, 503) 발생 시 즉시 다음 키/모델로 전환

### reportist-analyzer (HuggingFace)
- **역할**: 종목 스크리닝 + 13인 거장 심층 분석 보고서 생성 + 일일 배치 스케줄러
- **내부 서브도메인 & 모듈**:
  - `screener` — 토스 거장 공통 필터 + DataRoma 슈퍼인베스터 포트폴리오 스크리닝
  - `report` — DataPackBuilder + 13인 거장 심층 리포트 생성 파이프라인
  - `scheduler` — APScheduler 배치 (월~금 12:00 KST, 미장 휴장일 가드)
  - `error-log` — 에러 수집 및 Discord 알림

## 3. 데이터 흐름

```
[12:00 KST] scheduler 트리거
    → market_guard.is_market_open(today) 검사 (주말/공휴일 시 조기 종료)
    → screener.get_stock_list() → 토스 통과 종목 리스트 반환
    → roma.get_stock_list() → DataRoma 보유 종목 반환 (실패 시 무시하고 계속)
    → 중복 티커 제거 후 분석 대상(targets) 확정 (screeners 라벨 병합)
    → for ticker in targets:
        → [1단계] DataPackBuilder.build(ticker) → 팩트 데이터팩 구축
        → [2단계] 13인 거장 요약 블록 생성
        → [3단계] 최종 종합 투자 보고서 생성
        → [4단계] Supabase guru_reports, guru_opinions, guru_votes 저장
    → discord_notifier.send_pipeline_summary()
```

## 4. 핵심 설계 원칙

1. **Fact First** — Yahoo Finance, SEC 공시 등 객관적 팩트 데이터팩 선구축 후 거장 AI 분석 투입
2. **Deterministic Opinions** — 모델 및 프롬프트 버전 고정으로 판단 일관성 유지
3. **Resilient Scheduling** — 휴장일 가드 및 종목별 격리 처리로 일부 종목 실패 시에도 전체 배치 완주
4. **Transparent Audit** — 13인 거장 개별 평가 전문을 Supabase에 영속화하여 근거 추적 가능

