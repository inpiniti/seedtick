# Auto-Trading 알고리즘 (v3: 고정 갭 실시간 그리드 매매)

## 1. 그리드 파라미터 산출

- **처음매수주가 (`initial_price`)**: 수동 1회차 매수 체결가 ($)
- **고정 갭 (`gap`)**: `round(initial_price * 0.03, 4)` (불변)
- **마지막매매주가 (`last_trade_price`)**:
  - 초기값: `initial_price`
  - 매수 또는 매도 체결 시: 체결 단가(또는 감지 현재가)로 갱신
- **주문금액 (`order_amount_krw`)**: 1,000원 고정

---

## 2. 실시간 감지 및 주문 트리거

### 2.1 매도 트리거 (익절 갭 도달)
- **조건**: `current_price >= last_trade_price + gap`
- **실행**:
  1. 현재 보유 수량(`holdings_qty`) 조회
  2. 보유 수량이 없으면 (`holdings_qty <= 0`) -> 해당 종목 상태를 `FINISHED`로 종료 처리
  3. 환율(`fx_rate`) 조회 후 1,000원 상당의 매도 수량 계산:
     - `sell_qty = round(1000 / fx_rate / current_price, 4)`
     - 단, `sell_qty > holdings_qty`이면 `holdings_qty` 전량 매도
  4. 시장가 매도 주문 발주
  5. 체결 후:
     - 남은 수량이 0이면 -> 상태 `FINISHED` 마감
     - 남은 수량이 남아있으면 -> `last_trade_price = current_price`로 갱신

### 2.2 매수 트리거 (하락 갭 도달)
- **조건**: `current_price <= last_trade_price - gap`
- **실행**:
  1. 1,000원 상당 소수점 시장가 매수 주문 발주 (달러 금액: `1000 / fx_rate`)
  2. 체결 후:
     - `last_trade_price = current_price`로 갱신
     - 보유 수량 누적 증가

---

## 3. 보유 종목 동기화 예외 처리

- 주기적인 계좌 잔고 동기화 시, DB에 `ACTIVE` 상태로 등록되어 있으나 실제 계좌 포지션에서 사라진 종목은 즉시 `FINISHED` 처리하여 감지 목록에서 제외합니다.
