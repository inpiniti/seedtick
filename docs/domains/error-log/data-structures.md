# Error-Log 데이터 구조

## Pydantic 모델

```python
from typing import Any, Literal
from pydantic import BaseModel, Field

class AlertLevel(str):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class LogEvent(BaseModel):
    level: Literal["INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    logger_name: str | None = None
    code: str = "LOG"                      # 이벤트/에러 코드 (예: PIPELINE_START, BRIDGE_ERROR)
    message: str                           # 이벤트/에러 메시지
    context: dict[str, Any] = Field(default_factory=dict) # 추가 컨텍스트 (ticker, amount, error traceback 등)
    timestamp: str | None = None           # ISO 8601

class ErrorEvent(LogEvent):
    level: Literal["ERROR", "CRITICAL"] = "ERROR"
```

## Supabase 데이터베이스 테이블 명세 (`public.error_logs`)

```sql
create table if not exists public.error_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  level       text        not null,             -- INFO, WARNING, ERROR, CRITICAL
  logger_name text,                             -- 발신 로거 이름 (예: scheduler_jobs, guru_report_service)
  code        text        not null default 'LOG', -- 이벤트/에러 코드
  message     text        not null,             -- 로그/에러 메시지
  context     jsonb       not null default '{}'::jsonb -- 추가 메타데이터
);

create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);
create index if not exists error_logs_level_idx on public.error_logs (level);
create index if not exists error_logs_code_idx on public.error_logs (code);
```
