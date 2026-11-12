"""
자체 인메모리 대기열 및 워커, Redis 에뮬레이터 단위 테스트
"""
import asyncio
import time
import pytest

from app.domains.queue.models import JobItem, JobPriority, JobStatus
from app.domains.queue.service import InMemoryQueueService
from app.domains.queue.worker import QueueWorkerManager
from app.domains.queue.redis_emulator import RedisEmulator


@pytest.mark.asyncio
async def test_queue_enqueue_and_priority():
    svc = InMemoryQueueService()

    # 일반 작업 등록
    j1 = await svc.enqueue("test", {"name": "job1"}, priority=JobPriority.NORMAL.value)
    # 높은 우선순위 작업 등록
    j2 = await svc.enqueue("test", {"name": "job2"}, priority=JobPriority.HIGH.value)
    # 낮은 우선순위 작업 등록
    j3 = await svc.enqueue("test", {"name": "job3"}, priority=JobPriority.LOW.value)

    # 대기 순번 확인: j2(HIGH)가 0번(첫번째), j1(NORMAL)이 1번, j3(LOW)가 2번이어야 함
    pos2 = await svc.get_queue_position(j2.job_id)
    pos1 = await svc.get_queue_position(j1.job_id)
    pos3 = await svc.get_queue_position(j3.job_id)

    assert pos2 == 0
    assert pos1 == 1
    assert pos3 == 2

    # pop_next_job 시 우선순위가 가장 높은 j2가 먼저 나와야 함
    first = await svc.pop_next_job()
    assert first is not None
    assert first.job_id == j2.job_id
    assert first.status == JobStatus.PROCESSING


@pytest.mark.asyncio
async def test_queue_cancel_in_waiting():
    svc = InMemoryQueueService()

    j1 = await svc.enqueue("test", {"name": "cancel_me"})
    assert await svc.get_queue_position(j1.job_id) == 0

    # 취소
    success = await svc.cancel_job(j1.job_id)
    assert success is True

    # 취소 후 상태 확인
    job = await svc.get_job(j1.job_id)
    assert job is not None
    assert job.status == JobStatus.CANCELLED
    assert await svc.get_queue_position(j1.job_id) is None

    # pop_next_job 시 대기열에 없으므로 None
    next_job = await svc.pop_next_job()
    assert next_job is None


@pytest.mark.asyncio
async def test_queue_worker_execution():
    svc = InMemoryQueueService()
    worker = QueueWorkerManager(service=svc, concurrency=2)

    processed = []

    async def sample_handler(job: JobItem):
        await asyncio.sleep(0.05)
        processed.append(job.job_id)
        return {"done": True, "custom_res": 123}

    worker.register_handler("sample", sample_handler)
    await worker.start()

    try:
        j1 = await svc.enqueue("sample", {"val": 1})
        j2 = await svc.enqueue("sample", {"val": 2})

        # 워커가 처리할 시간을 줌
        for _ in range(20):
            job1 = await svc.get_job(j1.job_id)
            job2 = await svc.get_job(j2.job_id)
            if job1 and job1.status == JobStatus.COMPLETED and job2 and job2.status == JobStatus.COMPLETED:
                break
            await asyncio.sleep(0.05)

        job1 = await svc.get_job(j1.job_id)
        job2 = await svc.get_job(j2.job_id)
        assert job1.status == JobStatus.COMPLETED
        assert job2.status == JobStatus.COMPLETED
        assert job1.result == {"done": True, "custom_res": 123}
        assert j1.job_id in processed
        assert j2.job_id in processed
    finally:
        await worker.stop()


@pytest.mark.asyncio
async def test_queue_cleanup_gc():
    svc = InMemoryQueueService(default_ttl_sec=0)  # 즉시 만료 대상

    j1 = await svc.enqueue("test", {})
    await svc.complete_job(j1.job_id, {"res": "ok"})

    # 잠시 대기 후 cleanup 실행
    await asyncio.sleep(0.01)
    removed = await svc.cleanup(max_age_sec=0)
    assert removed == 1

    assert await svc.get_job(j1.job_id) is None


@pytest.mark.asyncio
async def test_redis_emulator():
    redis = RedisEmulator()

    # Key-Value
    assert await redis.set("test_key", "hello", ex_sec=10)
    assert await redis.get("test_key") == "hello"

    # List
    assert await redis.lpush("my_list", "item1", "item2") == 2
    assert await redis.llen("my_list") == 2
    popped = await redis.rpop("my_list")
    assert popped == "item1"

    # SortedSet (대기열 순번 테스트)
    await redis.zadd("waiting_queue", "user_a", 100.0)
    await redis.zadd("waiting_queue", "user_b", 200.0)
    await redis.zadd("waiting_queue", "user_c", 50.0)

    # 순번 확인: 점수가 낮은 user_c가 0번, user_a가 1번, user_b가 2번
    assert await redis.zrank("waiting_queue", "user_c") == 0
    assert await redis.zrank("waiting_queue", "user_a") == 1
    assert await redis.zrank("waiting_queue", "user_b") == 2

    # 제거
    assert await redis.zrem("waiting_queue", "user_a") == 1
    assert await redis.zrank("waiting_queue", "user_a") is None
