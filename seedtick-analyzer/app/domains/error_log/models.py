"""
Error-Log 도메인 모델 정의
"""
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
    code: str = "LOG"
    message: str
    context: dict[str, Any] = Field(default_factory=dict)
    timestamp: str | None = None


class ErrorEvent(LogEvent):
    level: Literal["ERROR", "CRITICAL"] = "ERROR"
