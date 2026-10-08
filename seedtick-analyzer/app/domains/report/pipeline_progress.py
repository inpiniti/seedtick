"""
13인 거장 리포트 파이프라인 진행 상태 추적기 (In-Memory)

- 스케줄러/수동 트리거가 파이프라인을 시작하면 메모리에 "실행중" 상태를 등록합니다.
- 관리자 화면(seedtick-admin)이 GET /api/scheduler/progress 를 폴링하여
  현재 단계, 종목 진행률(n/총), 13인 요약 진행률(n/13), 경과 시간을 실시간 표시합니다.
- 서버 프로세스 메모리에 보관되므로 서버 재시작 시 초기화됩니다. (화면 새로고침에는 안전)
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any, Literal

PipelineStatus = Literal["idle", "running", "completed", "failed", "skipped"]

# 프론트엔드 진행 표시 단계 (실제 실행 순서와 1:1 대응)
PIPELINE_STAGES: list[dict[str, str]] = [
    {"key": "screening", "label": "종목 스크리닝"},
    {"key": "datapack", "label": "1. 심층 데이터팩 수집"},
    {"key": "value_driver", "label": "2. 가치드라이버 팩 생성"},
    {"key": "summaries", "label": "3. 13인 거장 요약"},
    {"key": "master", "label": "4. 최종 마스터 보고서"},
    {"key": "sync", "label": "DB 동기화"},
]
_STAGE_KEYS = [s["key"] for s in PIPELINE_STAGES]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class PipelineProgressTracker:
    """단일 파이프라인 실행의 진행 상황을 메모리에 보관하는 스레드 안전 추적기."""

    def __init__(self, max_events: int = 80):
        self._lock = threading.Lock()
        self._max_events = max_events
        self._state: dict[str, Any] = self._idle_state()

    # ── 상태 조회 ─────────────────────────────────────────
    @staticmethod
    def _idle_state() -> dict[str, Any]:
        return {
            "status": "idle",
            "market": None,
            "started_at": None,
            "finished_at": None,
            "date": None,
            "triggered_by": None,
            "stage": None,
            "stage_index": -1,
            "stage_label": None,
            "gurus_done": 0,
            "gurus_total": 0,
            "total_tickers": 0,
            "completed_tickers": 0,
            "failed_tickers": 0,
            "current_ticker": None,
            "current_ticker_index": 0,
            "stage_started_at": None,
            "stage_elapsed_seconds": {},
            "tickers": [],
            "events": [],
            "error": None,
            "summary": None,
        }

    def is_running(self) -> bool:
        with self._lock:
            return self._state["status"] == "running"

    def snapshot(self) -> dict[str, Any]:
        """현재 진행 스냅샷 (프론트 폴링 응답용)."""
        with self._lock:
            state = dict(self._state)
            state["tickers"] = [dict(t) for t in self._state["tickers"]]
            state["events"] = list(self._state["events"])
            state["stages"] = [dict(s) for s in PIPELINE_STAGES]
            state["stage_elapsed_seconds"] = dict(
                self._state.get("stage_elapsed_seconds", {})
            )
        state["stage_total"] = len(PIPELINE_STAGES)
        state["stage_timings"] = self._build_stage_timings(state)
        state["elapsed_seconds"] = self._elapsed_seconds(
            state.get("started_at"), state.get("finished_at")
        )
        return state

    # ── 생명주기 ─────────────────────────────────────────
    def start(
        self,
        *,
        date: str | None = None,
        triggered_by: str = "manual",
        market: str = "all",
    ) -> None:
        with self._lock:
            self._state = self._idle_state()
            self._state.update(
                {
                    "status": "running",
                    "market": market,
                    "started_at": _now_iso(),
                    "date": date,
                    "triggered_by": triggered_by,
                }
            )
            m_label = {"us": "미국장(US)", "kr": "한국장(KR)"}.get(market.lower(), "전체(US+KR)")
            self._append_event_locked(f"파이프라인 시작 [{m_label}]")


    def finish(
        self,
        status: PipelineStatus = "completed",
        *,
        summary: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            self._finalize_current_stage_locked()
            self._state["status"] = status
            self._state["finished_at"] = _now_iso()
            self._state["summary"] = summary
            self._state["error"] = error
            self._append_event_locked(
                {
                    "completed": "파이프라인 정상 완료",
                    "skipped": "파이프라인 스킵",
                    "failed": "파이프라인 실패",
                }.get(status, status)
            )

    def reset(self) -> None:
        with self._lock:
            self._state = self._idle_state()

    # ── 진행 갱신 ─────────────────────────────────────────
    def set_targets(self, tickers: list[str]) -> None:
        with self._lock:
            self._state["total_tickers"] = len(tickers)
            self._state["tickers"] = [
                {"ticker": t, "status": "pending", "verdict": None} for t in tickers
            ]
            self._append_event_locked(f"분석 대상 {len(tickers)}개 종목 확정")

    def begin_ticker(self, ticker: str) -> None:
        with self._lock:
            self._state["current_ticker"] = ticker
            self._state["gurus_done"] = 0
            for idx, item in enumerate(self._state["tickers"], start=1):
                if item["ticker"] == ticker:
                    item["status"] = "processing"
                    self._state["current_ticker_index"] = idx
                    break
            self._append_event_locked(f"[{ticker}] 분석 시작")

    def complete_ticker(
        self, ticker: str, *, verdict: str | None = None, failed: bool = False
    ) -> None:
        with self._lock:
            for item in self._state["tickers"]:
                if item["ticker"] == ticker:
                    item["status"] = "failed" if failed else "done"
                    item["verdict"] = verdict
                    break
            if failed:
                self._state["failed_tickers"] += 1
            else:
                self._state["completed_tickers"] += 1
            suffix = f" · {verdict}" if verdict else ""
            self._append_event_locked(
                f"[{ticker}] 분석 {'실패' if failed else '완료'}{suffix}"
            )

    def set_stage(self, stage_key: str, detail: str | None = None) -> None:
        with self._lock:
            if self._state.get("stage") != stage_key:
                self._finalize_current_stage_locked()
            idx = _STAGE_KEYS.index(stage_key) if stage_key in _STAGE_KEYS else -1
            self._state["stage"] = stage_key
            self._state["stage_index"] = idx
            self._state["stage_label"] = (
                PIPELINE_STAGES[idx]["label"] if idx >= 0 else stage_key
            )
            self._state["stage_started_at"] = _now_iso()
            if detail:
                self._append_event_locked(detail)

    def set_guru_progress(self, done: int, total: int) -> None:
        with self._lock:
            self._state["gurus_done"] = done
            self._state["gurus_total"] = total

    def tick_guru(self) -> None:
        with self._lock:
            self._state["gurus_done"] += 1

    def log(self, message: str) -> None:
        with self._lock:
            self._append_event_locked(message)

    # ── 내부 ─────────────────────────────────────────────
    @staticmethod
    def _elapsed_seconds(started_at: str | None, finished_at: str | None) -> float:
        if not started_at:
            return 0.0
        start_dt = datetime.fromisoformat(started_at)
        end_dt = (
            datetime.fromisoformat(finished_at) if finished_at else datetime.now(timezone.utc)
        )
        return max(0.0, (end_dt - start_dt).total_seconds())

    def _append_event_locked(self, message: str) -> None:
        self._state["events"].append({"time": _now_iso(), "message": message})
        if len(self._state["events"]) > self._max_events:
            self._state["events"] = self._state["events"][-self._max_events:]

    def _finalize_current_stage_locked(self) -> None:
        stage_key = self._state.get("stage")
        started_at = self._state.get("stage_started_at")
        if not stage_key or not started_at:
            return
        elapsed = self._elapsed_seconds(started_at, _now_iso())
        stage_elapsed = self._state.setdefault("stage_elapsed_seconds", {})
        stage_elapsed[stage_key] = float(stage_elapsed.get(stage_key, 0.0)) + elapsed
        self._state["stage_started_at"] = None

    def _build_stage_timings(self, state: dict[str, Any]) -> list[dict[str, Any]]:
        status: PipelineStatus = state.get("status", "idle")
        current_key = state.get("stage")
        current_started_at = state.get("stage_started_at")
        current_idx = int(state.get("stage_index", -1))
        elapsed_map = {
            k: float(v) for k, v in (state.get("stage_elapsed_seconds") or {}).items()
        }

        if (
            status == "running"
            and current_key
            and current_started_at
            and current_key in _STAGE_KEYS
        ):
            elapsed_map[current_key] = float(
                elapsed_map.get(current_key, 0.0)
                + self._elapsed_seconds(current_started_at, None)
            )

        timings: list[dict[str, Any]] = []
        for idx, stage in enumerate(PIPELINE_STAGES):
            if idx < current_idx:
                stage_status = "done"
            elif idx == current_idx:
                if status == "running":
                    stage_status = "running"
                elif status == "failed":
                    stage_status = "failed"
                elif status in {"completed", "skipped"}:
                    stage_status = "done"
                else:
                    stage_status = "pending"
            else:
                stage_status = "pending"

            timings.append(
                {
                    "key": stage["key"],
                    "label": stage["label"],
                    "elapsed_seconds": round(elapsed_map.get(stage["key"], 0.0), 3),
                    "status": stage_status,
                }
            )
        return timings


# 프로세스 전역 싱글턴 (스케줄러·리포트 서비스·API 라우트가 공유)
pipeline_progress = PipelineProgressTracker()