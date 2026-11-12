"""
Queue & Worker API 라우트
- 대기열 작업 등록, 순번 조회, 취소, 통계
- 비디오 분석 전용 큐 엔드포인트
- 자체 Redis 에뮬레이션 REST 엔드포인트
"""
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.domains.queue.models import JobPriority, JobStatus
from app.domains.queue.service import queue_service
from app.domains.queue.worker import queue_worker
from app.domains.queue.redis_emulator import redis_emulator

router = APIRouter(prefix="/api/queue", tags=["queue"])


# ─────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────
class EnqueueJobRequest(BaseModel):
    job_type: str = Field(default="custom", description="작업 유형 (video_analysis, echo 등)")
    payload: dict[str, Any] = Field(default_factory=dict, description="작업 데이터 본문")
    priority: int = Field(default=JobPriority.NORMAL.value, description="우선순위 (0: LOW, 10: NORMAL, 20: HIGH, 30: URGENT)")
    custom_id: Optional[str] = Field(default=None, description="커스텀 작업 ID")


class VideoAnalyzeQueueRequest(BaseModel):
    videoName: str = Field(default="untitled_video", description="영상 파일명")
    videoDuration: float = Field(default=0.0, description="영상 총 길이 (초)")
    frames: list[dict[str, Any]] = Field(default_factory=list, description="추출된 키프레임 목록")
    locale: str = Field(default="ko", description="언어 코드 (ko, en, ja, zh 등)")
    model: Optional[str] = Field(default=None, description="요청 AI 모델명")
    prompt: Optional[str] = Field(default=None, description="커스텀 시스템/사용자 프롬프트")
    priority: int = Field(default=JobPriority.NORMAL.value, description="우선순위")


class RedisExecRequest(BaseModel):
    command: str = Field(..., description="Redis 명령어 (get, set, del, lpush, rpop, llen, zadd, zrank, zrem)")
    key: str
    args: list[Any] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────
# Queue Endpoints
# ─────────────────────────────────────────────────────────────
@router.post("/jobs", summary="새 작업 대기열 등록")
async def enqueue_job(req: EnqueueJobRequest):
    """
    작업을 대기열에 등록하고 job_id와 초기 대기 상태를 즉시 반환합니다.
    """
    job = await queue_service.enqueue(
        job_type=req.job_type,
        payload=req.payload,
        priority=req.priority,
        custom_id=req.custom_id,
    )
    position = await queue_service.get_queue_position(job.job_id)
    wait_sec = queue_service.get_estimated_wait_sec(position or 0, queue_worker.concurrency)
    return job.to_dict(queue_position=position, estimated_wait_sec=wait_sec)


@router.post("/video/analyze", summary="비디오 AI 분석 작업 대기열 등록 (전용 엔드포인트)")
async def enqueue_video_analysis(req: VideoAnalyzeQueueRequest):
    """
    reportist-video에서 영상 프레임 분석을 대기열에 넣을 때 사용하는 간소화된 엔드포인트입니다.
    """
    payload = req.model_dump()
    job = await queue_service.enqueue(
        job_type="video_analysis",
        payload=payload,
        priority=req.priority,
    )
    position = await queue_service.get_queue_position(job.job_id)
    wait_sec = queue_service.get_estimated_wait_sec(position or 0, queue_worker.concurrency)
    return job.to_dict(queue_position=position, estimated_wait_sec=wait_sec)


@router.get("/jobs/{job_id}", summary="작업 상태 및 대기 순번 조회")
async def get_job_status(job_id: str):
    """
    작업의 현재 상태, 진행률, 내 앞 대기자 수(queue_position), 예상 대기 시간을 조회합니다.
    """
    job = await queue_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="존재하지 않는 작업 ID입니다.")

    position = None
    wait_sec = None
    if job.status == JobStatus.QUEUED:
        position = await queue_service.get_queue_position(job_id)
        if position is not None:
            wait_sec = queue_service.get_estimated_wait_sec(position, queue_worker.concurrency)

    return job.to_dict(queue_position=position, estimated_wait_sec=wait_sec)


@router.post("/jobs/{job_id}/cancel", summary="작업 취소")
async def cancel_job(job_id: str):
    """
    대기 중이거나 처리 중인 작업을 취소합니다.
    """
    success = await queue_service.cancel_job(job_id)
    if not success:
        job = await queue_service.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="존재하지 않는 작업 ID입니다.")
        return {"cancelled": False, "message": f"현재 상태({job.status.value})에서는 취소할 수 없습니다."}

    return {"cancelled": True, "job_id": job_id}


@router.get("/stats", summary="대기열 및 워커 현황 통계")
async def get_queue_stats():
    """
    현재 대기 중/처리 중/완료된 작업 수 및 워커 동시 처리 수 등을 확인합니다.
    """
    stats = await queue_service.get_stats()
    stats["worker_concurrency"] = queue_worker.concurrency
    stats["registered_handlers"] = list(queue_worker._handlers.keys())
    return stats


# ─────────────────────────────────────────────────────────────
# Redis Emulator Endpoints (선택적 경량 Redis REST API)
# ─────────────────────────────────────────────────────────────
@router.post("/redis/exec", summary="HTTP Redis 커맨드 실행")
async def exec_redis_command(req: RedisExecRequest):
    """
    외부 Redis 없이 REST 요청으로 Redis 명령을 실행합니다.
    지원: get, set, del, expire, lpush, rpop, llen, zadd, zrank, zrem
    """
    cmd = req.command.lower()
    key = req.key
    args = req.args

    if cmd == "get":
        val = await redis_emulator.get(key)
        return {"result": val}
    elif cmd == "set":
        val = args[0] if args else True
        ex_sec = int(args[1]) if len(args) > 1 else None
        res = await redis_emulator.set(key, val, ex_sec=ex_sec)
        return {"result": res}
    elif cmd == "del":
        res = await redis_emulator.delete(key)
        return {"result": 1 if res else 0}
    elif cmd == "expire":
        ex_sec = int(args[0]) if args else 60
        res = await redis_emulator.expire(key, ex_sec)
        return {"result": 1 if res else 0}
    elif cmd == "lpush":
        res = await redis_emulator.lpush(key, *args)
        return {"result": res}
    elif cmd == "rpop":
        res = await redis_emulator.rpop(key)
        return {"result": res}
    elif cmd == "llen":
        res = await redis_emulator.llen(key)
        return {"result": res}
    elif cmd == "zadd":
        if len(args) < 2:
            raise HTTPException(status_code=400, detail="zadd requires member and score args")
        member = str(args[0])
        score = float(args[1])
        res = await redis_emulator.zadd(key, member, score)
        return {"result": res}
    elif cmd == "zrank":
        if not args:
            raise HTTPException(status_code=400, detail="zrank requires member arg")
        member = str(args[0])
        res = await redis_emulator.zrank(key, member)
        return {"result": res}
    elif cmd == "zrem":
        if not args:
            raise HTTPException(status_code=400, detail="zrem requires member arg")
        member = str(args[0])
        res = await redis_emulator.zrem(key, member)
        return {"result": res}
    else:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 Redis 커맨드: {cmd}")
