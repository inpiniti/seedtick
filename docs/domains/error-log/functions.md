# Error-Log 함수 명세

## ErrorLogService

이벤트 및 에러를 수집하여 Supabase `error_logs` 테이블에 적재합니다.

```python
class ErrorLogService:
    async def log(self, level: str, code: str, message: str, context: dict = {}, logger_name: str | None = None) -> bool: ...
    async def info(self, code: str, message: str, context: dict = {}, logger_name: str | None = None) -> bool: ...
    async def warning(self, code: str, message: str, context: dict = {}, logger_name: str | None = None) -> bool: ...
    async def error(self, code: str, message: str, context: dict = {}, logger_name: str | None = None) -> bool: ...
    async def critical(self, code: str, message: str, context: dict = {}, logger_name: str | None = None) -> bool: ...
```

## SupabaseLogHandler

Python 표준 `logging.Handler`를 상속받아, 시스템 전역의 `logger.info`, `logger.warning`, `logger.error` 로그를 백그라운드 비동기 큐를 통해 `error_logs` 테이블로 자동 전송합니다.

```python
class SupabaseLogHandler(logging.Handler):
    """
    내부 네트워크(httpx, supabase) 로그 무한 루프 방지 필터링 및
    백그라운드 큐 워커를 통한 비차단(non-blocking) DB 적재 핸들러
    """
    def emit(self, record: logging.LogRecord) -> None: ...
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
class DiscordNotifier:
    async def send_message(self, content: str, embeds: list[dict] | None = None) -> bool: ...
    async def notify_holiday_skip(self, reason: str) -> None: ...
    async def notify_pipeline_summary(self, date_str: str, screened_count: int, reported_count: int, orders: list) -> None: ...
```
