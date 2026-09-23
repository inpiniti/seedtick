# Scheduler 도메인 개요

## 역할

일정 시간마다 스크리닝→분석→매매 배치 파이프라인을 자동 실행합니다.

## 스케줄

| 잡 | 시간 (KST) | 설명 |
|:---|:---|:---|
| `daily_pipeline` | 18:00 | 스크리닝→리포트→자동매매 전체 실행 |
| `warm_up` | 외부 GitHub Actions | HuggingFace 슬립 방지 (17:00) |

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
