"""
PipelineProgressTracker 단위 테스트

관리자 화면이 폴링하는 진행 상태 스냅샷의 정확성을 검증합니다.
"""
from app.domains.report.pipeline_progress import (
    PIPELINE_STAGES,
    PipelineProgressTracker,
)


def test_tracker_idle_snapshot():
    tracker = PipelineProgressTracker()
    snap = tracker.snapshot()
    assert snap["status"] == "idle"
    assert snap["total_tickers"] == 0
    assert snap["completed_tickers"] == 0
    assert snap["elapsed_seconds"] == 0.0
    assert snap["stage_total"] == len(PIPELINE_STAGES)
    assert len(snap["stages"]) == len(PIPELINE_STAGES)


def test_tracker_full_lifecycle():
    tracker = PipelineProgressTracker()

    tracker.start(date="2026-10-02", triggered_by="manual")
    assert tracker.is_running() is True

    tracker.set_targets(["AAPL", "NVDA", "MSFT"])
    snap = tracker.snapshot()
    assert snap["total_tickers"] == 3
    assert [t["status"] for t in snap["tickers"]] == ["pending", "pending", "pending"]

    tracker.set_stage("screening")
    assert tracker.snapshot()["stage"] == "screening"

    tracker.begin_ticker("AAPL")
    snap = tracker.snapshot()
    assert snap["current_ticker"] == "AAPL"
    assert snap["current_ticker_index"] == 1

    tracker.set_stage("summaries")
    tracker.set_guru_progress(0, 13)
    tracker.tick_guru()
    tracker.tick_guru()
    assert tracker.snapshot()["gurus_done"] == 2
    assert tracker.snapshot()["gurus_total"] == 13

    tracker.complete_ticker("AAPL", verdict="매수")
    snap = tracker.snapshot()
    assert snap["completed_tickers"] == 1
    assert snap["tickers"][0]["status"] == "done"
    assert snap["tickers"][0]["verdict"] == "매수"

    tracker.begin_ticker("NVDA")
    tracker.complete_ticker("NVDA", failed=True)
    snap = tracker.snapshot()
    assert snap["failed_tickers"] == 1
    assert snap["tickers"][1]["status"] == "failed"

    tracker.finish("completed", summary={"reported_count": 1})
    snap = tracker.snapshot()
    assert tracker.is_running() is False
    assert snap["status"] == "completed"
    assert snap["finished_at"] is not None
    assert snap["elapsed_seconds"] >= 0.0
    assert snap["summary"] == {"reported_count": 1}


def test_tracker_stage_index_matches_frontend_order():
    tracker = PipelineProgressTracker()
    tracker.start()
    for idx, stage in enumerate(PIPELINE_STAGES):
        tracker.set_stage(stage["key"])
        assert tracker.snapshot()["stage_index"] == idx
        assert tracker.snapshot()["stage_label"] == stage["label"]


def test_tracker_event_buffer_is_capped():
    tracker = PipelineProgressTracker(max_events=5)
    tracker.start()
    for i in range(20):
        tracker.log(f"이벤트 {i}")
    snap = tracker.snapshot()
    assert len(snap["events"]) == 5
    # 가장 최근 이벤트가 뒤에 남아 있어야 함
    assert snap["events"][-1]["message"] == "이벤트 19"