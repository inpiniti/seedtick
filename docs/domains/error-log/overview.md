# Error-Log 도메인 개요

## 역할

시스템 전체(`seedtick-analyzer` 및 `seedtick-ai-gateway`)에서 발생하는 이벤트(정상 이벤트, 주의, 에러, 치명적 결함)를 수집하여 **Supabase `error_logs` 테이블에 영구 저장**하고, 주요 알림은 Discord 웹훅으로 발송합니다.

## 이벤트 레벨 및 처리

| 레벨 | 설명 | DB 테이블 저장 (`error_logs`) | Discord 알림 여부 |
|:---|:---|:---:|:---:|
| `INFO` | 정상 이벤트 (배치 시작/완료, 스크리닝 성공 등) | O (전체) | 선택적 (요약) |
| `WARNING` | 주의 이벤트 (일부 실패, 재시도, 임계치 도달) | O (전체) | O |
| `ERROR` | 에러 (매매 실패, 분석 실패, API 호출 에러) | O (전체) | O (즉시) |
| `CRITICAL` | 심각한 에러 (키 소진, 인증 실패, 프로세스 중단) | O (전체) | O (즉시) |

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
