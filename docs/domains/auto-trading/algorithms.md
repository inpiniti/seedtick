# Auto-Trading 알고리즘

## v1 매매 전략: 단순 시장가 매수

### 기본 설정
- 주문 방식: 시장가 (Market Order)
- 1회 매수 금액: 3만원 (설정 가능, 5만원 상한)
- 매도: v1에서는 없음

### 매수 우선순위 (동일 조건일 때)
1. confidence 높은 순
2. 이미 분석 순서 (screener 결과 순서)

### 예시 흐름

```
리포트 목록:
  NVDA: BUY, confidence=85  → ✅ 매수 3만원
  TSLA: BUY, confidence=65  → ❌ 확신도 부족 (70 미만)
  AAPL: HOLD, confidence=75 → ❌ 매수 신호 아님
  MSFT: BUY, confidence=78  → ✅ 매수 3만원
  
일일 사용: 6만원 (한도 10만원 내)
```

## v2 예정: 포지션 기반 매도

- 수익률 기준 자동 매도 (+15% 이익 실현, -10% 손절)
- Supabase에 포지션 기록 필요
- v1 검증 완료 후 구현
