# Error-Log 함수 명세

## ErrorLogService

```python
class ErrorLogService:
    async def info(self, code: str, message: str, context: dict = {}) -> None: ...
    async def warning(self, code: str, message: str, context: dict = {}) -> None: ...
    async def error(self, code: str, message: str, context: dict = {}) -> None: ...
    async def critical(self, code: str, message: str, context: dict = {}) -> None: ...
    async def notify_summary(self, stats: DailyTradeStats) -> None: ...
```

## Discord 메시지 형식

```
[ERROR] 2026-09-22 18:05 KST
코드: BRIDGE_ORDER_REJECTED
메시지: 토스증권 주문이 거부되었습니다
컨텍스트: ticker=NVDA, amount=30000
```

**CRITICAL은 @here 태그 포함:**
```
@here [CRITICAL] GATEWAY_ALL_KEYS_EXHAUSTED
모든 LLM API 키가 소진되었습니다. 즉시 확인 필요.
```

## Discord Notifier

```python
class DiscordNotifier(INotifier):
    async def send(self, event: ErrorEvent) -> None:
        payload = {
            "content": self._format(event),
            "username": "SeedTick Bot"
        }
        await httpx.post(self.webhook_url, json=payload)
```
