"""
AI 모델 순위 자동 전환(Fallback Chain) 단위 테스트

핵심 회귀 방어: 13인 거장 분석이 10개까지 동시 실행되므로, 1순위 모델이 과부하로
죽으면 요청 10개가 동시에 모델 레벨 실패를 감지한다. 이때 순위가 "실패한 요청 수"
만큼 내려가면 안 된다 — 실제 실패 모델이 하나면 순위도 한 단계만 내려가야 한다.

2026-10-01 운영 로그에서 1순위(nemotron) 하나만 실패했는데 48ms 안에 2→3→4→5순위
까지 내려가며 시도조차 하지 않은 2·3·4순위가 소모된 버그의 재현 테스트를 포함한다.
"""
import threading
import time

import pytest

from app.domains.report import model_rotation as mr_module
from app.domains.report.model_rotation import ModelRotation, ModelHealth, _parse_chain


@pytest.fixture
def rot():
    """테스트마다 새로운 회전 인스턴스(전역 싱글턴 오염 방지)"""
    r = ModelRotation()
    r.chain = ["m1", "m2", "m3", "m4", "m5", "m6"]
    r._health = {m: ModelHealth() for m in r.chain}
    return r


# ── 체인 파싱 ─────────────────────────────────────────────
def test_parse_chain_strips_and_dedupes():
    assert _parse_chain(" a , b , a , c ") == ["a", "b", "c"]
    assert _parse_chain("") == []
    assert _parse_chain(None) == []


# ── 기본 동작 ─────────────────────────────────────────────
def test_starts_at_first_rank(rot):
    assert rot.active_index == 0
    assert rot.active_model == "m1"
    assert rot.snapshot()["is_first"] is True


def test_single_model_chain_cannot_switch(rot):
    rot.chain = ["only"]
    rot._health = {"only": ModelHealth()}
    assert rot.advance("only", "HTTP 503") == "only"
    assert rot.active_index == 0


def test_advance_demotes_one_step(rot):
    assert rot.advance("m1", "HTTP 503") == "m2"
    assert rot.active_index == 1
    assert rot.snapshot()["switch_count"] == 1


def test_advance_wraps_around_at_end(rot):
    for i in range(5):
        rot.advance(f"m{i+1}", "HTTP 503")
    assert rot.active_index == 5
    # 마지막 순위 실패 시 1순위로 순환
    assert rot.advance("m6", "HTTP 503") == "m1"
    assert rot.active_index == 0


# ── 병렬 처리 (핵심 회귀 테스트) ──────────────────────────
def test_concurrent_failures_on_same_model_demote_only_once(rot):
    """
    운영 로그 재현: 1순위 하나가 죽었을 때 동시 요청 10개가 모두 실패를 보고한다.

    버그 버전에서는 advance()가 "현재 활성 모델"을 실패 모델로 간주했으므로
    10개 요청이 10단계씩 밀었다. 수정 버전에서는 첫 요청만 1→2로 내리고,
    나머지는 이미 전환된 m2를 그대로 이어받는다.
    """
    n_requests = 10
    start = threading.Barrier(n_requests)
    results: list[str] = []
    results_lock = threading.Lock()

    def worker():
        start.wait()  # 최대한 동시에 출발시켜 실제 경합을 만든다
        returned = rot.advance("m1", "m1 → HTTP 503")
        with results_lock:
            results.append(returned)

    threads = [threading.Thread(target=worker) for _ in range(n_requests)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # 순위는 정확히 한 단계만 내려갔다
    assert rot.active_index == 1
    assert rot.active_model == "m2"
    # 그리고 모든 요청이 2순위를 이어받았다
    assert set(results) == {"m2"}
    assert len(results) == n_requests


def test_concurrent_failures_do_not_skip_untried_ranks(rot):
    """버그의 핵심: 시도되지 않은 순위가 통째로 소모되면 안 된다."""
    n = 8
    barrier = threading.Barrier(n)

    def worker():
        barrier.wait()
        rot.advance("m1", "m1 → HTTP 503")

    threads = [threading.Thread(target=worker) for _ in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # m3 이상은 아무도 시도하지 않았으므로 활성 모델은 반드시 m2
    assert rot.active_model == "m2"
    assert rot.snapshot()["switch_count"] == 1


def test_failures_recorded_for_actually_failed_model_only(rot):
    """
    버그: advance()가 현재 활성 모델 이름을 실패 기록에 썼으므로, 실제로는
    한 번도 실패하지 않은 m2/m3/m4에 nemotron의 실패 사유가 기록됐다.
    """
    for _ in range(4):
        rot.advance("m1", "m1 → HTTP 503")

    failures = rot.snapshot()["failures"]
    assert set(failures) == {"m1"}
    assert "m2" not in failures
    assert "m3" not in failures


def test_stale_failure_from_older_rank_does_not_demote(rot, monkeypatch):
    """
    프로모션으로 1순위가 복구된 뒤, 이전에 진입했던 요청이 늦게 1순위 실패를
    보고하는 상황. 이때 또다시 강등하면 복구가 무의미해진다.
    """
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_PROMOTION_COOLDOWN_SEC", 60.0)
    rot.chain = ["m1", "m2", "m3"]
    rot._health = {m: ModelHealth() for m in rot.chain}

    rot.advance("m1", "HTTP 503")  # m2로 강등
    assert rot.active_model == "m2"

    # 쿨다운 경과 → 프로모션되어 1순위로 복귀
    rot._health_of("m1").last_failure_ts = time.monotonic() - 61.0
    assert rot.active_model == "m1"
    assert rot.active_index == 0


# ── 실패 임계값 ───────────────────────────────────────────
def test_threshold_delays_demotion(rot, monkeypatch):
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_FAILURE_THRESHOLD", 3)
    # 연속 실패 1회, 2회: 강등되지 않음
    assert rot.advance("m1", "HTTP 503") == "m1"
    assert rot.advance("m1", "HTTP 503") == "m1"
    assert rot.active_index == 0
    # 3회째에 강등
    assert rot.advance("m1", "HTTP 503") == "m2"
    assert rot.active_index == 1


def test_threshold_one_demotes_immediately(rot, monkeypatch):
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_FAILURE_THRESHOLD", 1)
    assert rot.advance("m1", "HTTP 503") == "m2"


def test_threshold_is_per_model(rot, monkeypatch):
    """임계값은 전역이 아니라 모델별 연속 실패로 판정해야 한다."""
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_FAILURE_THRESHOLD", 2)
    rot.advance("m1", "HTTP 503")  # m1: 1회
    rot.advance("m1", "HTTP 503")  # m1: 2회 → 강등 to m2
    assert rot.active_model == "m2"
    # m2는 새 모델이므로 연속 실패 0부터 시작
    assert rot._health_of("m2").consecutive_failures == 0


# ── 성공 시 카운터 해제 ────────────────────────────────────
def test_note_success_resets_counters(rot):
    rot.advance("m1", "HTTP 503")
    assert rot._health_of("m1").consecutive_failures == 1
    assert rot._health_of("m1").backoff_sec > 0

    rot.note_success("m1")
    assert rot._health_of("m1").consecutive_failures == 0
    assert rot._health_of("m1").backoff_sec == 0.0


def test_success_resets_streak_so_threshold_restarts(rot, monkeypatch):
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_FAILURE_THRESHOLD", 2)
    rot.advance("m1", "HTTP 503")  # streak 1
    rot.note_success("m1")  # streak 리셋
    rot.advance("m1", "HTTP 503")  # streak 1 again — 강등되면 안 됨
    assert rot.active_index == 0


# ── half-open 복구 ────────────────────────────────────────
def test_promotion_after_cooldown_elapsed(rot, monkeypatch):
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_PROMOTION_COOLDOWN_SEC", 60.0)
    rot.advance("m1", "HTTP 503")
    assert rot.active_model == "m2"

    # 쿨다운이 지나지 않았으므로 그대로
    assert rot.active_model == "m2"

    # 쿨다운 경과 시뮬레이션
    rot._health_of("m1").last_failure_ts = time.monotonic() - 61.0
    assert rot.active_model == "m1"  # 1순위로 복귀
    assert rot.active_index == 0


def test_no_promotion_before_cooldown(rot, monkeypatch):
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_PROMOTION_COOLDOWN_SEC", 600.0)
    rot.advance("m1", "HTTP 503")
    rot._health_of("m1").last_failure_ts = time.monotonic() - 100.0
    assert rot.active_model == "m2"  # 아직 600초가 안 지남


def test_promoted_model_success_clears_backoff(rot, monkeypatch):
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_PROMOTION_COOLDOWN_SEC", 60.0)
    rot.advance("m1", "HTTP 503")
    rot._health_of("m1").last_failure_ts = time.monotonic() - 61.0
    assert rot.active_model == "m1"

    rot.note_success("m1")
    assert rot._health_of("m1").backoff_sec == 0.0
    assert rot._health_of("m1").consecutive_failures == 0


def test_repeated_promotion_failure_doubles_backoff(rot, monkeypatch):
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_PROMOTION_COOLDOWN_SEC", 60.0)
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_PROMOTION_MAX_COOLDOWN_SEC", 240.0)

    rot.advance("m1", "HTTP 503")
    assert rot._health_of("m1").backoff_sec == 60.0

    # 프로모션 → 다시 실패 → 백오프 2배
    rot._health_of("m1").last_failure_ts = time.monotonic() - 61.0
    assert rot.active_model == "m1"
    rot.advance("m1", "HTTP 503")
    assert rot._health_of("m1").backoff_sec == 120.0

    rot._health_of("m1").last_failure_ts = time.monotonic() - 121.0
    assert rot.active_model == "m1"
    rot.advance("m1", "HTTP 503")
    assert rot._health_of("m1").backoff_sec == 240.0

    # 상한 클램프
    rot._health_of("m1").last_failure_ts = time.monotonic() - 241.0
    assert rot.active_model == "m1"
    rot.advance("m1", "HTTP 503")
    assert rot._health_of("m1").backoff_sec == 240.0


def test_never_failed_model_is_not_promoted(rot, monkeypatch):
    """실패 이력이 없는 상위 모델로 프로모션되면 안 된다."""
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_PROMOTION_COOLDOWN_SEC", 60.0)
    rot.advance("m1", "HTTP 503")  # m2로
    rot._health_of("m1").backoff_sec = 0.0  # 억지로 쿨다운 제거
    assert rot.active_model == "m2"  # total_failures==0이므로 프로모션 안 됨


def test_promotion_disabled_when_cooldown_zero(rot, monkeypatch):
    monkeypatch.setattr(mr_module.settings, "AI_MODEL_PROMOTION_COOLDOWN_SEC", 0.0)
    rot.advance("m1", "HTTP 503")
    assert rot.active_model == "m2"  # 프로모션 기능 비활성
    assert rot.active_index == 1


# ── 초기화 ────────────────────────────────────────────────
def test_reset_restores_first_rank_and_clears_health(rot):
    rot.advance("m1", "HTTP 503")
    rot.advance("m2", "HTTP 503")
    assert rot.active_index == 2

    assert rot.reset("테스트 초기화") == "m1"
    assert rot.active_index == 0
    assert rot._health_of("m1").backoff_sec == 0.0
    assert rot._health_of("m1").consecutive_failures == 0
    assert rot.snapshot()["switch_count"] == 0


def test_record_failure_does_not_switch_rank(rot):
    rot.record_failure("m1", "HTTP 429 quota exceeded")
    assert rot.active_index == 0
    assert rot.snapshot()["failures"]["m1"] == "HTTP 429 quota exceeded"


def test_snapshot_exposes_health_per_model(rot):
    rot.advance("m1", "HTTP 503")
    health = rot.snapshot()["health"]
    assert health["m1"]["total_failures"] == 1
    assert health["m1"]["consecutive_failures"] == 1
    assert health["m2"]["total_failures"] == 0


def test_empty_chain_falls_back_to_settings_model(rot, monkeypatch):
    rot.chain = []
    assert rot.active_model == mr_module.settings.AI_GATEWAY_MODEL