# Error-Log 데이터 구조

```python
from pydantic import BaseModel
from typing import Literal

class AlertLevel(str):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class ErrorEvent(BaseModel):
    level: Literal["INFO", "WARNING", "ERROR", "CRITICAL"]
    code: str               # 에러 코드 (error-codes.md 참조)
    message: str
    context: dict = {}      # 추가 컨텍스트 (ticker, amount 등)
    timestamp: str          # ISO 8601
```
