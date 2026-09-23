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
