# Auto-Trading 도메인 개요

## 역할

Report 도메인이 생성한 리포트를 바탕으로 실제 매수/매도 주문을 실행합니다.

## 핵심 원칙

1. **리포트가 유일한 신호** — 자체 판단 없음, 리포트 기반으로만 결정
2. **재시도 없음** — 실패는 로그 + 알림. 다음 날 재시도
3. **일일 한도 강제** — 코드 레벨에서 초과 불가
4. **Paper-Trading 우선** — 실거래 전 반드시 검증

## 매수 조건 (AND)

- `report.verdict == "BUY"`
- `report.confidence >= 70`
- 당일 동일 종목 중복 주문 없음
- 일일 총 매매 금액 < 10만원

## 매도 전략 (v2)

### 분할 매도 조건 (AND)

- `report.overall_verdict` == "관망" 또는 "매도"
- `broker.get_balance().positions[ticker] > 0` (실제 보유 중인 종목만)
- 당일 동일 종목 중복 매도 없음
- 매도 일일 한도 없음 (포지션 정리 우선)

### 매도 금액

- 관망·매도 모두 `DEFAULT_ORDER_AMOUNT_KRW` (1만원)씩 분할 매도
- 보유 수량 미확인 시 매도 스킵 (잔고 조회 실패 포함)

### 불변식 (Invariants)

- 보유하지 않은 종목은 절대 매도 발주하지 않는다
- 동일 종목에 대해 하루에 매도 1회만 허용한다
- 매도 금액 단위는 `DEFAULT_ORDER_AMOUNT_KRW` (1만원) 고정

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [알고리즘](./algorithms.md)
- [테스트 케이스](./tests.md)
- [안전 규칙](../../rules/safety-rules.md)
