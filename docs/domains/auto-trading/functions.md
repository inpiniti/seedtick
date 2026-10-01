# Auto-Trading 함수 명세 (v3: GridTradingService)

## GridTradingService

### `manual_buy_and_register(ticker: str) -> GridTradeItem`
- 미국 정규장 운영 여부(`broker.is_us_market_open()`) 검사. 미운영 시 예외 발생.
- 1,000원치 시장가 매수 주문 발주 (`broker.place_order`).
- 체결가(또는 최신 호가)로 `initial_price`, `gap(= initial_price * 0.03)`, `last_trade_price` 계산.
- Supabase `grid_trades` 테이블에 INSERT.
- 실시간 토스 WebSocket 구독 목록에 ticker 추가.

### `on_realtime_tick(ticker: str, price: float) -> None`
- 등록된 `ACTIVE` 상태의 종목인지 확인.
- 종목별 동시성 락(`asyncio.Lock`) 획득.
- `price >= item.last_trade_price + item.gap`:
  - 1,000원 상당 매도 수량 계산 및 `broker.place_order(SELL)` 발주.
  - 잔여 수량이 0이면 `status = FINISHED`, 남았으면 `last_trade_price = price`.
- `price <= item.last_trade_price - item.gap`:
  - 1,000원 상당 매수 `broker.place_order(BUY)` 발주.
  - `last_trade_price = price`, 누적 매수 횟수 및 수량 갱신.
- Supabase DB 업데이트.

### `sync_with_holdings() -> None`
- `broker.get_balance()`로 실제 보유 포지션 조회.
- DB에 `ACTIVE` 상태인데 실제 포지션 수량이 0인 종목은 자동으로 `status = FINISHED` 처리.
