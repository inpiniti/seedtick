"""
OnDemandProgressTracker: 온디맨드 단일 종목 심층 분석 전용 진행 상태 추적기

- 일일 배치 추적기(pipeline_progress)와 완전히 분리되어 각 종목별 진행 상태를 독립 관리합니다.
- GuruReportService의 진행 콜백 인터페이스(set_stage, set_guru_progress, tick_guru, log)를 충족합니다.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any, Literal

OnDemandStatus = Literal["pending", "running", "completed", "failed"]

ONDEMAND_STAGES: list[dict[str, str]] = [
    {"key": "datapack", "label": "1. 심층 데이터팩 수집"},
    {"key": "value_driver", "label": "2. 가치드라이버 및 촉매 발굴"},
    {"key": "summaries", "label": "3. 13인 거장 심층 분석"},
    {"key": "master", "label": "4. 마스터 종합 투자 보고서"},
    {"key": "sync", "label": "5. 데이터베이스 동기화 완료"},
]
_STAGE_KEYS = [s["key"] for s in ONDEMAND_STAGES]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class OnDemandProgressTracker:
    def __init__(self, ticker: str) -> None:
        self.ticker = ticker.upper().strip()
        self._lock = threading.Lock()
        self._status: OnDemandStatus = "pending"
        self._stage: str = "datapack"
        self._stage_index: int = 1
        self._stage_label: str = ONDEMAND_STAGES[0]["label"]
        self._gurus_done: int = 0
        self._gurus_total: int = 13
        self._started_at: str | None = None
        self._finished_at: str | None = None
        self._verdict: str | None = None
        self._overall_score: int | None = None
        self._message: str = f"[{self.ticker}] 분석 준비 중..."
        self._error: str | None = None
        self._events: list[str] = []

    def start(self) -> None:
        with self._lock:
            self._status = "running"
            self._started_at = _now_iso()
            self._message = f"[{self.ticker}] 13인 거장 심층 분석을 시작합니다."
            self._events.append(f"{_now_iso()} | 분석 시작")

    def finish(
        self,
        *,
        verdict: str | None = None,
        overall_score: int | None = None,
        error: str | None = None,
    ) -> None:
        with self._lock:
            self._finished_at = _now_iso()
            if error:
                self._status = "failed"
                self._error = error
                self._message = f"[{self.ticker}] 분석 실패: {error}"
                self._events.append(f"{_now_iso()} | 오류 발생: {error}")
            else:
                self._status = "completed"
                self._verdict = verdict
                self._overall_score = overall_score
                self._stage = "sync"
                self._stage_index = len(ONDEMAND_STAGES)
                self._stage_label = ONDEMAND_STAGES[-1]["label"]
                self._message = f"[{self.ticker}] 분석 완료! 종합의견: {verdict or '완료'}"
                self._events.append(f"{_now_iso()} | 정상 완료 (판정: {verdict})")

    # ── GuruReportService 호환 콜백 인터페이스 ────────────────────────
    def set_stage(self, stage_key: str, detail: str | None = None) -> None:
        with self._lock:
            self._stage = stage_key
            idx = _STAGE_KEYS.index(stage_key) if stage_key in _STAGE_KEYS else -1
            self._stage_index = idx + 1 if idx >= 0 else 1
            self._stage_label = (
                ONDEMAND_STAGES[idx]["label"] if idx >= 0 else stage_key
            )
            if detail:
                self._message = detail
                self._events.append(f"{_now_iso()} | {detail}")
            else:
                self._message = f"[{self.ticker}] {self._stage_label} 진행 중..."

    def set_guru_progress(self, done: int, total: int, ticker: str | None = None) -> None:
        with self._lock:
            self._gurus_done = done
            self._gurus_total = total
            self._message = f"[{self.ticker}] 13인의 거장 심층 평가 중 ({done}/{total})"

    def tick_guru(self, ticker: str | None = None) -> None:
        with self._lock:
            self._gurus_done = min(self._gurus_total, self._gurus_done + 1)
            self._message = (
                f"[{self.ticker}] 13인의 거장 심층 평가 중 ({self._gurus_done}/{self._gurus_total})"
            )

    def log(self, message: str) -> None:
        with self._lock:
            self._events.append(f"{_now_iso()} | {message}")

    def begin_ticker(self, ticker: str) -> None:
        pass

    def complete_ticker(
        self, ticker: str, *, verdict: str | None = None, failed: bool = False
    ) -> None:
        if failed:
            self.finish(error="종목 분석 처리 실패")
        else:
            self.finish(verdict=verdict)

    # ── 프론트엔드 폴링 스냅샷 ──────────────────────────────────────
    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            elapsed = 0
            if self._started_at:
                try:
                    s_dt = datetime.fromisoformat(self._started_at)
                    e_dt = (
                        datetime.fromisoformat(self._finished_at)
                        if self._finished_at
                        else datetime.now(timezone.utc)
                    )
                    elapsed = int((e_dt - s_dt).total_seconds())
                except Exception:
                    elapsed = 0

            # 전체 대략 진행률 퍼센트 계산 (0~100)
            percent = 5
            if self._status == "completed":
                percent = 100
            elif self._status == "failed":
                percent = 100
            elif self._status == "pending":
                percent = 5
            elif self._stage == "datapack":
                percent = 15
            elif self._stage == "value_driver":
                percent = 30
            elif self._stage == "summaries":
                # 30% ~ 80% 사이를 13명 거장 완료 비율로 보간
                ratio = self._gurus_done / max(1, self._gurus_total)
                percent = int(30 + ratio * 50)
            elif self._stage == "master":
                percent = 85
            elif self._stage == "sync":
                percent = 95

            res = {
                "ticker": self.ticker,
                "status": self._status,
                "stage": self._stage,
                "stage_label": self._stage_label,
                "stage_index": self._stage_index,
                "stage_total": len(ONDEMAND_STAGES),
                "progress_percent": percent,
                "gurus_done": self._gurus_done,
                "gurus_total": self._gurus_total,
                "started_at": self._started_at,
                "finished_at": self._finished_at,
                "elapsed_seconds": elapsed,
                "verdict": self._verdict,
                "overall_score": self._overall_score,
                "message": self._message,
                "error": self._error,
                "stages": list(ONDEMAND_STAGES),
            }

            # 대기열 정보 보충
            try:
                active_list = ondemand_manager.get_active_tickers()
                if self.ticker in active_list:
                    pos = active_list.index(self.ticker) + 1
                else:
                    pos = 1
                res["queue_position"] = pos
                res["active_tickers"] = active_list
                res["active_count"] = len(active_list)
                res["estimated_minutes"] = max(20, pos * 20)
            except Exception:
                res["queue_position"] = 1
                res["active_tickers"] = [self.ticker]
                res["active_count"] = 1
                res["estimated_minutes"] = 20

            return res


class OnDemandTrackerManager:
    """메모리 상에서 종목별 OnDemandProgressTracker를 관리"""

    def __init__(self) -> None:
        self._trackers: dict[str, OnDemandProgressTracker] = {}
        self._lock = threading.Lock()

    def get_or_create(self, ticker: str) -> OnDemandProgressTracker:
        clean = ticker.upper().strip()
        with self._lock:
            tracker = self._trackers.get(clean)
            if not tracker:
                tracker = OnDemandProgressTracker(clean)
                self._trackers[clean] = tracker
            elif tracker._status in ("completed", "failed"):
                # 이미 완료되었거나 실패한 지난 트래커면 새로 생성
                tracker = OnDemandProgressTracker(clean)
                self._trackers[clean] = tracker
            return tracker

    def get(self, ticker: str) -> OnDemandProgressTracker | None:
        clean = ticker.upper().strip()
        with self._lock:
            return self._trackers.get(clean)

    def get_active_tickers(self) -> list[str]:
        """현재 진행 중(pending, running)인 티커 목록을 등록 순서대로 반환"""
        with self._lock:
            active: list[tuple[str, str]] = []
            for t_code, tracker in self._trackers.items():
                if tracker._status in ("pending", "running"):
                    started = tracker._started_at or ""
                    active.append((t_code, started))
            # 시작 시각 기준 오름차순 정렬 (먼저 들어온 요청이 앞순번)
            active.sort(key=lambda x: x[1])
            return [t[0] for t in active]


# 싱글톤 인스턴스
ondemand_manager = OnDemandTrackerManager()

