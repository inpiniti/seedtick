# Scheduler 도메인 개요

## 역할

미국 정규장 개장 전, 스크리닝 → 심층 분석(13인 거장) → 매매 배치 파이프라인을 자동 실행합니다.

## 스케줄 및 휴장일 스킵 정책

| 잡 | 시간 (KST) | 설명 |
|:---|:---|:---|
| `daily_pipeline` | 매일 18:00 (월~금) | 스크리닝 → 데이터팩 → 13인 리포트 → 자동매매 |
| `warm_up` | 외부 GitHub Actions | HuggingFace 슬립 방지 (17:00) |

### ⚠️ 필수 휴장일 가드 (Market Holiday Guard)
- **주말 스킵**: 토요일, 일요일은 파이프라인을 실행하지 않고 즉시 스킵합니다.
- **미국 증시(NYSE/NASDAQ) 공식 휴장일 스킵**:
  - 신정(New Year's Day), 마틴 루터 킹의 날(MLK Day), 프레지던트 데이(Presidents' Day), 성금요일(Good Friday), 메모리얼 데이(Memorial Day), 준틴스(Juneteenth), 독립기념일(Independence Day), 노동절(Labor Day), 추수감사절(Thanksgiving Day), 크리스마스(Christmas)
  - 휴장일 판별 라이브러리: `holidays.US(market="NYSE")` 또는 토스 마켓 캘린더 API(`/market-calendar/US`) 조회
  - 휴장일일 경우 에러가 아닌 `[INFO] 오늘은 미국 증시 휴장일({holiday_name})입니다. 파이프라인을 스킵합니다.` 로그를 남기고 종료.

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
