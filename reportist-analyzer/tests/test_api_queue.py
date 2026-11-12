"""
Queue & Redis API 엔드포인트 통합 테스트
"""
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_queue_api_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. 작업 등록 (POST /api/queue/jobs)
        res = await ac.post(
            "/api/queue/jobs",
            json={
                "job_type": "echo",
                "payload": {"msg": "hello_queue"},
                "priority": 10,
            },
        )
        assert res.status_code == 200
        job_data = res.json()
        job_id = job_data["job_id"]
        assert job_data["status"] in ("queued", "processing", "completed")
        assert "queue_position" in job_data

        # 2. 상태 조회 (GET /api/queue/jobs/{id})
        res_get = await ac.get(f"/api/queue/jobs/{job_id}")
        assert res_get.status_code == 200
        status_data = res_get.json()
        assert status_data["job_id"] == job_id
        assert status_data["job_type"] == "echo"

        # 3. 비디오 분석 전용 큐 등록 (POST /api/queue/video/analyze)
        res_video = await ac.post(
            "/api/queue/video/analyze",
            json={
                "videoName": "sample_travel.mp4",
                "videoDuration": 15.5,
                "frames": [{"timestamp": 1.0, "dataUrl": "data:image/jpeg;base64,abc"}],
                "locale": "ko",
            },
        )
        assert res_video.status_code == 200
        video_job = res_video.json()
        assert video_job["job_type"] == "video_analysis"

        # 4. 취소 테스트 (POST /api/queue/jobs/{id}/cancel)
        res_cancel = await ac.post(f"/api/queue/jobs/{video_job['job_id']}/cancel")
        assert res_cancel.status_code == 200
        cancel_data = res_cancel.json()
        assert cancel_data["cancelled"] is True

        # 5. 통계 조회 (GET /api/queue/stats)
        res_stats = await ac.get("/api/queue/stats")
        assert res_stats.status_code == 200
        stats = res_stats.json()
        assert "worker_concurrency" in stats
        assert "registered_handlers" in stats


@pytest.mark.asyncio
async def test_redis_emulator_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. SET
        res = await ac.post("/api/queue/redis/exec", json={"command": "set", "key": "foo", "args": ["bar"]})
        assert res.status_code == 200

        # 2. GET
        res = await ac.post("/api/queue/redis/exec", json={"command": "get", "key": "foo"})
        assert res.status_code == 200
        assert res.json()["result"] == "bar"

        # 3. ZADD & ZRANK
        await ac.post("/api/queue/redis/exec", json={"command": "zadd", "key": "waitlist", "args": ["user_1", 10.0]})
        await ac.post("/api/queue/redis/exec", json={"command": "zadd", "key": "waitlist", "args": ["user_2", 20.0]})

        res_rank1 = await ac.post("/api/queue/redis/exec", json={"command": "zrank", "key": "waitlist", "args": ["user_1"]})
        assert res_rank1.json()["result"] == 0

        res_rank2 = await ac.post("/api/queue/redis/exec", json={"command": "zrank", "key": "waitlist", "args": ["user_2"]})
        assert res_rank2.json()["result"] == 1
