"""
Job Queue 도메인 데이터 모델
"""
from dataclasses import dataclass, field
from enum import Enum
import time
from typing import Any, Optional
import uuid


class JobStatus(str, Enum):
    QUEUED = "queued"          # 대기열 진입
    PROCESSING = "processing"  # 워커에서 처리 중
    COMPLETED = "completed"    # 성공 완료
    FAILED = "failed"          # 에러 발생
    CANCELLED = "cancelled"    # 사용자 또는 시스템 취소


class JobPriority(int, Enum):
    LOW = 0
    NORMAL = 10
    HIGH = 20
    URGENT = 30


@dataclass
class JobItem:
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    job_type: str = "custom"                  # e.g., 'video_analysis', 'report_generation', 'ai_chat'
    payload: dict[str, Any] = field(default_factory=dict)
    priority: int = JobPriority.NORMAL.value
    status: JobStatus = JobStatus.QUEUED
    progress: float = 0.0                     # 0.0 ~ 100.0 (%)
    progress_message: str = ""
    reasoning_preview: str = ""               # AI 실시간 추론 미리보기 (최근 텍스트)
    result: Optional[Any] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    cancel_requested: bool = False

    def to_dict(self, queue_position: Optional[int] = None, estimated_wait_sec: Optional[float] = None) -> dict[str, Any]:
        data = {
            "job_id": self.job_id,
            "job_type": self.job_type,
            "status": self.status.value,
            "priority": self.priority,
            "progress": self.progress,
            "progress_message": self.progress_message,
            "reasoning_preview": self.reasoning_preview,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "elapsed_sec": (
                (self.finished_at or time.time()) - (self.started_at or self.created_at)
                if self.started_at
                else 0.0
            ),
            "result": self.result,
            "error": self.error,
        }
        if queue_position is not None:
            data["queue_position"] = queue_position
        if estimated_wait_sec is not None:
            data["estimated_wait_sec"] = estimated_wait_sec
        return data
