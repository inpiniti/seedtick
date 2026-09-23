# 자동매매 안전 규칙 🔴

> **경고**: 이 규칙은 코드 레벨에서 강제됩니다.
> 규칙을 우회하거나 삭제하면 안 됩니다.

---

## 1. 절대 규칙 (Hard Limits)

```python
# config/constants.py
DAILY_MAX_AMOUNT_KRW = 100_000   # 일일 최대 매매 금액: 10만원
MAX_ORDERS_PER_DAY = 5           # 일일 최대 주문 종목 수
MAX_AMOUNT_PER_ORDER_KRW = 50_000 # 종목당 최대 매매 금액: 5만원
MIN_REPORT_CONFIDENCE = 70       # 매수 실행 최소 확신도 (0-100)
```

이 값들은 환경변수로 오버라이드 불가. 상수로 고정합니다.

---

## 2. 중복 주문 방지

- 같은 ticker, 같은 날짜에는 1회만 주문 허용
- `orders` 테이블에서 `UNIQUE(ticker, date(created_at))`로 DB 레벨에서도 강제
- 코드에서도 주문 전 `OrderManager.is_already_ordered(ticker, date)` 확인 필수

```python
class OrderManager:
    async def is_already_ordered(self, ticker: str, date: date) -> bool:
        result = await supabase.table("orders").select("id").eq("ticker", ticker).eq("date", date).execute()
        return len(result.data) > 0
```

---

## 3. Paper-Trading 모드

```python
# 환경변수로 제어
PAPER_TRADING_MODE = os.getenv("PAPER_TRADING_MODE", "true")  # 기본값: true

# auto_trading/service.py 내부
if settings.PAPER_TRADING_MODE == "true":
    # 실제 주문 대신 로그만 기록
    logger.info(f"[PAPER] BUY {ticker} {amount_krw}원 (실제 주문 안 됨)")
    return OrderResult(success=True, order_id="PAPER-" + ..., ...)
```

**실거래 전 체크리스트:**
- [ ] 최소 1주일 paper-trading 로그 확인
- [ ] 예상치 못한 매매 패턴 없는지 검토
- [ ] `PAPER_TRADING_MODE=false` 로 변경

---

## 4. 에러 시 즉각 중단

- 매매 실패 시 **재시도 없음**
- 실패 내용 로그 기록 + Discord 즉시 알림
- 다음 날 배치에서 자동으로 재시도

```python
result = await broker.place_order(order)
if not result.success:
    # 재시도 X, 로그 + 알림만
    await error_log.critical(
        code="BRIDGE_ORDER_REJECTED",
        message=result.error_message,
        context={"ticker": ticker, "amount": amount_krw}
    )
    return  # 중단
```

---

## 5. 매수 신호 조건 (AND 조건, 모두 만족 시에만 실행)

```python
def should_execute_buy(report: Report) -> bool:
    return (
        report.verdict == "BUY"           # 매수 판정
        and report.confidence >= 70        # 확신도 70 이상
        and not await is_already_ordered() # 당일 중복 주문 없음
        and total_today_amount < DAILY_MAX # 일일 한도 미초과
    )
```

---

## 6. 알림 필수 항목

다음 이벤트는 반드시 Discord 웹훅으로 알림:

- 배치 시작/완료 (종목 수, 소요 시간)
- 매수/매도 주문 실행 결과
- 에러 발생 (모든 ERROR 이상 레벨)
- 모든 키 소진 (CRITICAL)

```python
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
# 없으면 콘솔 로그만 (알림 비활성화 허용하지 않음, 반드시 설정)
```
