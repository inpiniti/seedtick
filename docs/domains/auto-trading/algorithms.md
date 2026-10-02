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

> **장외 시간 정책**: 정규장이 아니면 갭 감지(현재가 SSE 방송, 갭 도달 판정)는 계속되지만 **발주는 시도하지 않습니다.**
> 정규장 여부는 60초 TTL로 캐시해 틱마다 캘린더 API를 다시 호출하지 않습니다.

### 2.1 매도 트리거 (익절 갭 도달)
- **조건**: `current_price >= last_trade_price + gap`
- **실행** (정규장시에만):
  1. 현재 보유 수량(`holdings_qty`) 조회
  2. 보유 수량이 없으면 (`holdings_qty <= 0`) -> 해당 종목 상태를 `FINISHED`로 종료 처리
  3. 환율(`fx_rate`) 조회 후 매도 수량 계산 — **보유 수량을 절대 초과하지 않도록 캡**:
     - `sell_qty = min(round(order_amount_krw / fx_rate / current_price, 4), holdings_qty)`
     - `sell_qty <= 0`이면 -> `FINISHED` 종료 처리
  4. `quantity = sell_qty` 수량 지정 시장가 매도 발주 (초과 매도 원천 차단)
  5. 체결 후:
     - 남은 수량이 0이면 -> 상태 `FINISHED` 마감
     - 남은 수량이 남아있으면 -> `last_trade_price = current_price`로 갱신

> **주문 필드 규칙**: `BrokerOrder.quantity`가 지정되면 브로커는 `orderAmount`(달러 금액) 대신 `quantity`(주 수량)로 발주합니다.
> 토스 `orderAmount`는 미국 시장가 **매수** 전용이라, 매도는 반드시 수량 지정으로 보냅니다.

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
