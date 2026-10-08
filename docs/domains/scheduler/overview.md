# Scheduler 도메인 개요

## 역할

미국 정규장 개장 전, 스크리닝 → 심층 분석(13인 거장) → 매매 배치 파이프라인을 자동 실행합니다.

## 스케줄 및 휴장일 스킵 정책

| 잡 | 시간 (KST) | 설명 | 대상 시장 |
|:---|:---|:---|:---|
| `reset_model_rotation` | 매일 00:01 (KST) | AI 모델 순위 1순위 초기화 | 공통 |
| `cleanup_old_logs` | 매일 08:00 (KST) | 미국장 배치 1시간 전, 24시간 이전의 만료된 INFO 시스템 로그 선별 삭제 (DB 용량 최적화) | 공통 |
| `us_daily_pipeline` | 매일 09:00 (월~금) | 미국 정규장 마감 후: 토스 해외 200 + DataRoma 스크리닝 → 13인 정밀 리포트 | 미국(NYSE) |
| `kr_daily_pipeline` | 매일 16:00 (월~금) | 한국 정규장(15:30) 마감 후: 국장 실시간 발굴(조건강화 5단계) → 13인 정밀 리포트 | 한국(KRX) |

### ⚠️ 필수 휴장일 가드 (Market Holiday Guard)
- **주말 스킵**: 토요일, 일요일은 파이프라인을 실행하지 않고 즉시 스킵합니다.
- **미국 증시(NYSE) 공식 휴장일 스킵 (`is_us_market_open`)**:
  - 신정(New Year's Day), 마틴 루터 킹의 날(MLK Day), 프레지던트 데이(Presidents' Day), 성금요일(Good Friday), 메모리얼 데이(Memorial Day), 준틴스(Juneteenth), 독립기념일(Independence Day), 노동절(Labor Day), 추수감사절(Thanksgiving Day), 크리스마스(Christmas)
  - 판별 라이브러리: `holidays.financial_holidays("NYSE")`
- **한국 증시(KRX) 공식 휴장일 스킵 (`is_kr_market_open`)**:
  - 신정, 설날 연휴, 삼일절, 근로자의 날(5/1), 어린이날, 부처님오신날, 현충일, 광복절, 추석 연휴, 개천절, 한글날, 성탄절, 연말 폐장일(12/31) 등
  - 판별 라이브러리: `holidays.financial_holidays("KRX")`
- 휴장일일 경우 에러가 아닌 `[INFO] [SeedTick 스케줄러] 오늘은 {reason}입니다. 파이프라인을 실행하지 않고 스킵합니다.` 로그 및 Discord 알림을 남기고 안전하게 종료.


## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)

## 실시간 진행 상태 추적 (Pipeline Progress)

파이프라인은 메모리 전역 싱글턴 `pipeline_progress`(`PipelineProgressTracker`)에 "실행중" 상태를 등록합니다.
관리자 화면(`seedtick-admin`)은 `GET /api/scheduler/progress`를 폴링하여 아래를 실시간 표시합니다.

- 현재 단계: `스크리닝 → 1. 데이터팩 → 2. 가치드라이버 → 3. 거장 요약(n/13) → 4. 최종 마스터 → DB 동기화`
- 전체 종목 진행률: `완료 n / 총 m` (예: `3/21`)
- 현재 분석 종목 및 인덱스
- 경과 시간(초) 및 시작/종료 시각
- 종목별 성공/실패/판정 결과, 최근 진행 로그

### 백그라운드 실행 계약

- `POST /api/scheduler/trigger`는 이제 파이프라인을 백그라운드 태스크로 시작하고 **즉시 응답**합니다. (완료를 기다리지 않음)
- 이미 실행 중이면 `{"status": "skipped", "reason": "already_running"}`를 반환하며, 화면에서는 실행 버튼이 비활성화됩니다.
- 진행 상태는 서버 프로세스 메모리에 보관되므로 **화면 새로고침/재접속 후에도 이어서 조회**됩니다. 단, 서버 프로세스가 재시작되면 `idle`로 초기화됩니다.
