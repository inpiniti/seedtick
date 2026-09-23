# Auto-Trading 함수 명세

## AutoTradingService

### `execute_from_reports(reports: list[Report]) -> list[TradeResult]`

리포트 목록을 받아 조건을 만족하는 종목의 주문을 실행합니다.

**흐름**:
```
for report in reports:
    if not should_execute_buy(report):
        continue
    order = build_order(report)
    result = await broker.place_order(order)
    await supabase.save_order(result)
    if not result.success:
        await error_log.error(...)
```

---

## OrderManager

### `is_already_ordered(ticker: str, date: date) -> bool`

Supabase `orders` 테이블에서 당일 중복 주문 확인.

### `get_daily_stats(date: date) -> DailyTradeStats`

당일 매매 현황 조회.

### `can_order_more(amount: int, stats: DailyTradeStats) -> bool`

일일 한도 초과 여부 확인.

---

## 함수: should_execute_buy

```python
async def should_execute_buy(
    report: Report,
    stats: DailyTradeStats,
    order_manager: OrderManager
) -> bool:
    if report.verdict != "BUY":
        return False
    if report.confidence < MIN_REPORT_CONFIDENCE:
        return False
    if await order_manager.is_already_ordered(report.ticker, today()):
        return False
    if not order_manager.can_order_more(AMOUNT_PER_ORDER_KRW, stats):
        return False
    return True
```
