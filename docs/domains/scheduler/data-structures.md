# Scheduler 데이터 구조

```python
from pydantic import BaseModel
from typing import Literal

class JobStatus(BaseModel):
    job_id: str
    status: Literal["PENDING", "RUNNING", "DONE", "FAILED"]
    started_at: str | None
    finished_at: str | None
    tickers_total: int = 0
    tickers_done: int = 0
    errors: list[str] = []

class TriggerResult(BaseModel):
    job_id: str
    status: Literal["started", "already_running", "failed"]
    message: str
```

## PipelineProgress (실시간 진행 상태 스냅샷)

`GET /api/scheduler/progress` 응답이자 `PipelineProgressTracker.snapshot()` 반환 구조.

```python
class PipelineStageMeta(BaseModel):
    key: Literal[
        "screening", "datapack", "value_driver",
        "summaries", "discussion", "master", "sync",
    ]
    label: str

class PipelineTickerProgress(BaseModel):
    ticker: str
    status: Literal["pending", "processing", "done", "failed"]
    verdict: str | None = None

class PipelineProgress(BaseModel):
    status: Literal["idle", "running", "completed", "failed", "skipped"]
    started_at: str | None
    finished_at: str | None
    elapsed_seconds: float            # 폴링 시점 기준 경과 시간
    date: str | None
    triggered_by: str | None
    stage: str | None                 # 현재 단계 key
    stage_index: int                  # 0-based, -1 = 미시작
    stage_label: str | None
    stage_total: int                  # 전체 단계 수
    stages: list[PipelineStageMeta]
    gurus_done: int                   # 현재 종목의 13인 요약 완료 수
    gurus_total: int                  # 보통 13
    total_tickers: int                # 분모 (예: 21)
    completed_tickers: int            # 분자 (예: 3)
    failed_tickers: int
    current_ticker: str | None
    current_ticker_index: int
    tickers: list[PipelineTickerProgress]
    events: list[dict]                # {time, message} 최근 진행 로그
    error: str | None
    summary: dict | None              # 종료 시 결과 요약
```
