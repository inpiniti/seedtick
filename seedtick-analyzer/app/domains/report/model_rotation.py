"""
AI 모델 순위(Fallback Chain) 자동 관리

배경
----
`nvidia/nemotron-3-ultra-550b-a55b:free` 는 OpenRouter 상에서 트래픽이 몰리면
HTTP 200 안쪽에 `{"error": {"code": 503, "message": "Upstream error from
Nvidia: Service temporarily overloaded"}}` 형태로 에러를 반환한다. 키 로테이션
으로는 해결되지 않으므로 **모델 자체를 다음 순위로 내려가야** 한다.

동작
----
- 순위 체인은 설정 `AI_MODEL_CHAIN`(쉼표 구분)에서 읽는다.
- 모듈 레벨 싱글턴이므로 `AiGatewayClient` 인스턴스가 여러 개 생성돼도 상태가 공유된다.
  (리포트 서비스가 매번 새 인스턴스를 만드는 구조이므로 인스턴스 상태로는 관리가 불가)
- 하루가 바뀌면(KST 00:00) 1순위로 초기화된다.
- 서버 재시작 시에도 프로세스 상태이므로 자연스럽게 1순위로 돌아간다.

병렬 처리에서 순위가 소모되는 문제 (핵심)
----------------------------------------
13인 거장 분석은 10개까지 동시 실행되므로, 1순위가 과부하로 죽으면 **요청 10개가
동시에** 모델 레벨 실패를 감지한다. 이때 순위가 "실패한 요청 수"만큼 내려가면 안 된다.
2026-10-01 운영 로그에서 실제로 1순위(nemotron) 하나만 실패했는데 48ms 안에
2→3→4→5순위까지 내려가며, 시도조차 하지 않은 2·3·4순위가 통째로 소모되었다.

원인은 `advance()`가 **어떤 모델이 실패했는지**를 몰랐던 것이다. 현재 활성 모델을
실패 모델로 간주하고 무조건 인덱스를 +1 했기 때문에, 동시 요청 4개가 4단계씩 밀었다.

따라서 `advance()`는 실패한 모델을 인자로 받는다. 그 모델이 더 이상 활성 모델이
아니라면 다른 동시 요청이 이미 강등을 처리했다는 뜻이므로 순위를 더 내리지 않고
현재 활성 모델을 그대로 반환한다(멱등). 덕분에 N개 요청이 같은 모델에서 동시에
실패해도 순위는 정확히 한 단계만 내려가고, 나머지는 이미 전환된 2순위를 이어받는다.

복구 (half-open)
---------------
과부하는 실제로 몇 분 안에 풀리는데, 순위는 00:01 리셋까지 내려가 있었다. 그래서
강등된 모델의 쿨다운이 지나면 상위 순위를 한 번 더 시도해 본다. 성공하면
`note_success()`가 백오프를 초기화해 그 순위에 정착하고, 또 실패하면 다시 강등되며
백오프가 2배가 된다(같은 불량 모델을 반복해서 찍지 않기 위해).
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config.settings import settings

logger = logging.getLogger("model_rotation")

def _utcnow_iso() -> str:
    """현재 UTC 시각을 'Z' 접미사 ISO 문자열로 반환"""
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat() + "Z"


# KST 기준 자정 다음 리셋 시각
_KST_OFFSET = timedelta(hours=9)


def _parse_chain(raw: str | None) -> list[str]:
    """쉼표 구분 문자열 -> 중복 제거된 순위 목록"""
    if not raw:
        return []
    seen: set[str] = set()
    chain: list[str] = []
    for item in raw.split(","):
        model = item.strip()
        if model and model not in seen:
            seen.add(model)
            chain.append(model)
    return chain


# 설정에서 순위 체인을 읽되, 미설정 시 기존 단일 모델로 1단계 체인을 구성한다(하위 호환)
DEFAULT_MODEL_CHAIN: list[str] = _parse_chain(settings.AI_MODEL_CHAIN) or [
    settings.AI_GATEWAY_MODEL
]


@dataclass
class ModelHealth:
    """개별 모델의 실패 이력 (강등/복구 판단용)"""

    # 연속 실패 횟수. 성공하면 0으로 리셋. AI_MODEL_FAILURE_THRESHOLD 비교에 사용
    consecutive_failures: int = 0
    # 누적 실패 횟수. 이 모델이 한 번이라도 실패했는지(=강등된 적 있는지) 판별용
    total_failures: int = 0
    # 마지막 실패 시각 (time.monotonic 기준). 프로모션 쿨다운 계산에 사용
    last_failure_ts: float | None = None
    # 현재 적용되는 프로모션 쿨다운(초). 강등될 때마다 2배, 성공하면 초기값으로 복귀
    backoff_sec: float = 0.0


@dataclass
class RotationState:
    """모델 순위 상태 스냅샷"""

    index: int = 0
    switch_count: int = 0
    switched_at: str | None = None
    last_reason: str | None = None
    # 모델별 누적 실패 사유 (admin 화면에서 "왜 지금 이 순위인가" 확인용)
    failures: dict[str, str] = field(default_factory=dict)


class ModelRotation:
    """
    프로세스 전역 모델 순위 관리자.

    스레드 안전(threading.RLock). `active_model` 조회가 실패 임계값과 복구 쿨다운을
    함께 반영하므로, 호출자는 "지금 이 순간에 쓸 수 있는 최고 순위 모델"을 얻는다.
    """

    def __init__(self) -> None:
        # RLock 필수: advance()/_maybe_promote()가 이미 락을 잡은 상태에서 active_model
        # 프로퍼티(자체 락)를 읽으므로 재진입이 가능해야 한다. (Lock이면 데드락)
        self._lock = threading.RLock()
        self.chain: list[str] = list(DEFAULT_MODEL_CHAIN)
        self._state = RotationState()
        self._health: dict[str, ModelHealth] = {
            model: ModelHealth() for model in self.chain
        }

    # ── 내부 헬퍼 ───────────────────────────────────────────
    def _health_of(self, model: str) -> ModelHealth:
        """체인에 없는 모델이면 상태를 지연 생성한다(설정 리로드 대비)."""
        health = self._health.get(model)
        if health is None:
            health = ModelHealth()
            self._health[model] = health
        return health

    def _model_at(self, index: int) -> str:
        """락을 이미 잡은 상태에서 호출할 것 (프로퍼티 재진입 회피)."""
        if not self.chain:
            return settings.AI_GATEWAY_MODEL
        return self.chain[index % len(self.chain)]

    def _threshold(self) -> int:
        return max(1, settings.AI_MODEL_FAILURE_THRESHOLD)

    def _base_cooldown(self) -> float:
        return max(0.0, settings.AI_MODEL_PROMOTION_COOLDOWN_SEC)

    def _max_cooldown(self) -> float:
        return max(self._base_cooldown(), settings.AI_MODEL_PROMOTION_MAX_COOLDOWN_SEC)

    def _maybe_promote(self) -> None:
        """
        하향 상태에서 상위 순위의 쿨다운이 지났으면 한 단계 되돌린다 (half-open).

        성공하면 note_success()가 백오프를 초기화하므로 그 순위에 정착한다.
        또 실패하면 advance()가 다시 강등시키며 백오프가 2배가 된다.
        """
        if len(self.chain) <= 1 or self._state.index == 0:
            return

        target_index = (self._state.index - 1) % len(self.chain)
        target = self._model_at(target_index)
        health = self._health_of(target)

        # 실패 이력이 없는 모델은 강등된 적이 없으므로 프로모션 대상이 아니다
        if health.total_failures == 0 or health.backoff_sec <= 0:
            return
        if health.last_failure_ts is None:
            return
        if (time.monotonic() - health.last_failure_ts) < health.backoff_sec:
            return

        self._state.index = target_index
        health.consecutive_failures = 0
        logger.info(
            f"[ModelRotation] 순위 복구 시도 (프로모션): {self._model_at(target_index + 1)}"
            f" → {target} — 쿨다운 {health.backoff_sec:.0f}s 경과"
        )

    # ── 조회 ────────────────────────────────────────────────
    @property
    def active_model(self) -> str:
        with self._lock:
            if not self.chain:
                return settings.AI_GATEWAY_MODEL
            self._maybe_promote()
            return self._model_at(self._state.index)

    @property
    def active_index(self) -> int:
        with self._lock:
            return self._state.index

    def snapshot(self) -> dict[str, Any]:
        """admin 화면 / API 응답용 상태 덤프"""
        with self._lock:
            self._maybe_promote()
            chain = list(self.chain)
            idx = self._state.index % len(chain) if chain else 0
            active = chain[idx] if chain else settings.AI_GATEWAY_MODEL
            return {
                "chain": chain,
                "active_model": active,
                "active_index": idx,
                "is_first": idx == 0,
                "switch_count": self._state.switch_count,
                "switched_at": self._state.switched_at,
                "last_reason": self._state.last_reason,
                "failures": dict(self._state.failures),
                "next_reset_at": self._next_reset_iso(),
                "health": {
                    model: {
                        "consecutive_failures": self._health_of(model).consecutive_failures,
                        "total_failures": self._health_of(model).total_failures,
                        "backoff_sec": self._health_of(model).backoff_sec,
                    }
                    for model in chain
                },
            }

    def _next_reset_iso(self) -> str:
        """다음 KST 자정 (다음 순위 초기화 시점)"""
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        now_kst = now_utc + _KST_OFFSET
        next_kst = now_kst.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
            days=1
        )
        return (next_kst - _KST_OFFSET).isoformat() + "Z"

    # ── 상태 변경 ────────────────────────────────────────────
    def advance(self, failed_model: str, reason: str) -> str:
        """
        `failed_model` 이 모델 레벨 실패를 보였다고 보고하고, 다음에 사용할 모델을 반환한다.

        멱등성 보장 (병렬 처리 핵심): `failed_model` 이 이미 활성 모델이 아니라면 다른
        동시 요청이 이 모델의 강등을 이미 처리했다는 뜻이므로 **순위를 더 내리지 않고**
        현재 활성 모델을 그대로 반환한다. 덕분에 N개 요청이 같은 모델에서 동시에
        실패해도 순위는 정확히 한 단계만 내려간다.

        이미 마지막 순위라면 1순위로 되돌아간다(순환).
        """
        with self._lock:
            self._state.failures[failed_model] = reason

            health = self._health_of(failed_model)
            health.consecutive_failures += 1
            health.total_failures += 1
            health.last_failure_ts = time.monotonic()

            if len(self.chain) <= 1:
                logger.warning(
                    f"[ModelRotation] 순위 체인이 1개뿐이라 전환 불가 (실패: {reason})"
                )
                return failed_model

            current = self._model_at(self._state.index)
            if failed_model != current:
                # 다른 요청이 이미 이 모델을 넘겨버렸다 → 추가 강등하지 않음
                logger.debug(
                    f"[ModelRotation] [{failed_model}] 실패는 이미 다른 요청이 처리 "
                    f"(현재 활성={current}) → 순위 유지 — 사유: {reason}"
                )
                return current

            threshold = self._threshold()
            if health.consecutive_failures < threshold:
                logger.info(
                    f"[ModelRotation] [{failed_model}] 연속 실패 "
                    f"{health.consecutive_failures}/{threshold}회 — 아직 강등하지 않음 "
                    f"(사유: {reason})"
                )
                return current

            # 강등: 이 모델의 프로모션 쿨다운을 2배로 늘린다(최대값 클램프)
            health.backoff_sec = min(
                health.backoff_sec * 2
                if health.backoff_sec > 0
                else self._base_cooldown(),
                self._max_cooldown(),
            )

            self._state.index = (self._state.index + 1) % len(self.chain)
            self._state.switch_count += 1
            self._state.switched_at = _utcnow_iso()
            self._state.last_reason = reason
            new_model = self._model_at(self._state.index)
            logger.warning(
                f"[ModelRotation] 모델 순위 전환: {failed_model} → {new_model} "
                f"({self._state.index + 1}/{len(self.chain)}순위) — 사유: {reason} "
                f"(복구 시도까지 {health.backoff_sec:.0f}s)"
            )
            return new_model

    def note_success(self, model: str) -> None:
        """
        `model` 이 응답에 성공했음을 기록한다.

        연속 실패 카운터를 초기화하고 프로모션 백오프를 0으로 되돌린다.
        프로모션으로 되돌아온 모델이 실제로 살아있음을 확인하는 신호로 쓰인다.
        """
        with self._lock:
            health = self._health_of(model)
            if health.consecutive_failures == 0 and health.backoff_sec == 0.0:
                return
            health.consecutive_failures = 0
            health.backoff_sec = 0.0
            logger.info(
                f"[ModelRotation] [{model}] 성공 확인 → 연속 실패 카운터/백오프 초기화"
            )

    def record_failure(self, model: str, reason: str) -> None:
        """전환 없이 실패 사유만 기록 (키/네트워크 계열 오류)"""
        with self._lock:
            self._state.failures[model] = reason

    def reset(self, reason: str = "일일 초기화 (KST 00:00)") -> str:
        """1순위로 초기화"""
        with self._lock:
            was = (
                self._model_at(self._state.index)
                if self.chain
                else settings.AI_GATEWAY_MODEL
            )
            self._state = RotationState()
            # 자정 리셋에서는 실패 이력까지 함께 초기화한다. 프로바이더 과부하는
            # 자정 지나면 자연 복구되는 패턴이므로 백오프를 들고 있으면 안 된다.
            self._health = {model: ModelHealth() for model in self.chain}
            now = (
                self._model_at(self._state.index)
                if self.chain
                else settings.AI_GATEWAY_MODEL
            )
            if was != now:
                logger.info(f"[ModelRotation] 모델 순위 초기화: {was} → {now} — {reason}")
            else:
                logger.info(f"[ModelRotation] 모델 순위 1순위 정상 유지 ({now}) — {reason}")
            return now


# 프로세스 전역 싱글턴 — 여러 AiGatewayClient 인스턴스가 공유한다.
model_rotation = ModelRotation()