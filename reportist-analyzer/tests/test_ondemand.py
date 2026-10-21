import asyncio
import pytest
from app.domains.report.ondemand_tracker import (
    OnDemandProgressTracker,
    OnDemandTrackerManager,
)
from app.domains.scheduler.coordinator import PipelineCoordinator


@pytest.mark.asyncio
async def test_pipeline_coordinator_pause_and_resume():
    coordinator = PipelineCoordinator()
    assert not coordinator.is_paused
    assert coordinator.active_ondemand_count == 0

    # 1. 온디맨드 스코프 진입 -> 일시정지 신호 발동
    async with coordinator.ondemand_scope("LMT"):
        assert coordinator.is_paused
        assert coordinator.active_ondemand_count == 1

        # 중첩/다중 온디맨드 요청 시
        async with coordinator.ondemand_scope("079550"):
            assert coordinator.is_paused
            assert coordinator.active_ondemand_count == 2

        # 1개 종료 후에도 여전히 pause 상태
        assert coordinator.is_paused
        assert coordinator.active_ondemand_count == 1

    # 2. 모든 온디맨드 종료 -> 배치 재개
    assert not coordinator.is_paused
    assert coordinator.active_ondemand_count == 0


@pytest.mark.asyncio
async def test_pipeline_coordinator_wait_blocks_when_paused():
    coordinator = PipelineCoordinator()
    unblocked = False

    async def _batch_worker():
        nonlocal unblocked
        await coordinator.wait_if_paused()
        unblocked = True

    # 온디맨드 시작 -> pause 상태
    async with coordinator.ondemand_scope("NVDA"):
        task = asyncio.create_task(_batch_worker())
        await asyncio.sleep(0.05)
        # 배치 워커는 아직 대기 중이어야 함
        assert not unblocked

    # 온디맨드 종료 후
    await asyncio.sleep(0.05)
    assert unblocked
    await task


def test_ondemand_progress_tracker_lifecycle():
    tracker = OnDemandProgressTracker("079550")
    snap0 = tracker.snapshot()
    assert snap0["status"] == "pending"
    assert snap0["ticker"] == "079550"
    assert snap0["progress_percent"] == 5

    tracker.start()
    snap1 = tracker.snapshot()
    assert snap1["status"] == "running"

    tracker.set_stage("datapack")
    assert tracker.snapshot()["stage"] == "datapack"
    assert tracker.snapshot()["progress_percent"] == 15

    tracker.set_stage("value_driver")
    assert tracker.snapshot()["progress_percent"] == 30

    tracker.set_stage("summaries")
    tracker.set_guru_progress(6, 13)
    snap_guru = tracker.snapshot()
    assert snap_guru["gurus_done"] == 6
    assert snap_guru["progress_percent"] > 30

    tracker.tick_guru()
    assert tracker.snapshot()["gurus_done"] == 7

    tracker.set_stage("master")
    assert tracker.snapshot()["progress_percent"] == 85

    tracker.finish(verdict="적극 매수", overall_score=85)
    snap_done = tracker.snapshot()
    assert snap_done["status"] == "completed"
    assert snap_done["progress_percent"] == 100
    assert snap_done["verdict"] == "적극 매수"
    assert snap_done["overall_score"] == 85


def test_ondemand_tracker_manager():
    manager = OnDemandTrackerManager()
    t1 = manager.get_or_create("AAPL")
    assert t1.ticker == "AAPL"
    assert manager.get("AAPL") is t1
    assert manager.get("aapl") is t1

    t1.start()
    t2 = manager.get_or_create("079550")
    t2.start()

    active = manager.get_active_tickers()
    assert "AAPL" in active
    assert "079550" in active
    assert active.index("AAPL") == 0
    assert active.index("079550") == 1

    t2_snap = t2.snapshot()
    assert t2_snap["queue_position"] >= 1
    assert t2_snap["estimated_minutes"] >= 20

