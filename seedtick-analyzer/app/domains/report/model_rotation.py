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
- 하루가 바뀌면(KST 00:00) 1순위로 초기화된다. Provider 과부하가 자정 지나면
  자연 복구되는 패턴이라, 하루 단위 리셋이 의도된 동작이다.
- 서버 재시작 시에도 프로세스 상태이므로 자연스럽게 1순위로 돌아간다.
"""
from __future__ import annotations

import logging
import threading
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

    스레드 안전(threading.Lock) + 동시 요청에 대해 chat() 진입 시 스냅샷을
    읽고, 실패 시 다음 순위로 전진한다.
    """

    def __init__(self) -> None:
        # RLock 필수: advance()/reset()이 이미 락을 잡은 상태에서 active_model
        # 프로퍼티(자체 락)를 읽으므로 재진입이 가능해야 한다. (Lock이면 데드락)
        self._lock = threading.RLock()
        self.chain: list[str] = list(DEFAULT_MODEL_CHAIN)
        self._state = RotationState()

    # ── 조회 ────────────────────────────────────────────────
    @property
    def active_model(self) -> str:
        with self._lock:
            if not self.chain:
                return settings.AI_GATEWAY_MODEL
            return self.chain[self._state.index % len(self.chain)]

    @property
    def active_index(self) -> int:
        with self._lock:
            return self._state.index

    def snapshot(self) -> dict[str, Any]:
        """admin 화면 / API 응답용 상태 덤프"""
        with self._lock:
            chain = list(self.chain)
            idx = self._state.index % len(chain) if chain else 0
            return {
                "chain": chain,
                "active_model": chain[idx] if chain else settings.AI_GATEWAY_MODEL,
                "active_index": idx,
                "is_first": idx == 0,
                "switch_count": self._state.switch_count,
                "switched_at": self._state.switched_at,
                "last_reason": self._state.last_reason,
                "failures": dict(self._state.failures),
                "next_reset_at": self._next_reset_iso(),
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
    def advance(self, reason: str) -> str:
        """
        다음 순위 모델로 전진. 새 활성 모델을 반환한다.

        이미 마지막 순위라면 1순위로 되돌아간다(순환).
        """
        with self._lock:
            failed = self.active_model
            self._state.failures[failed] = reason
            if len(self.chain) <= 1:
                logger.warning(f"[ModelRotation] 순위 체인이 1개뿐이라 전환 불가 (실패: {reason})")
                return failed

            self._state.index = (self._state.index + 1) % len(self.chain)
            self._state.switch_count += 1
            self._state.switched_at = _utcnow_iso()
            self._state.last_reason = reason
            new_model = self.active_model
            logger.warning(
                f"[ModelRotation] 모델 순위 전환: {failed} → {new_model} "
                f"({self._state.index + 1}/{len(self.chain)}순위) — 사유: {reason}"
            )
            return new_model

    def record_failure(self, model: str, reason: str) -> None:
        """전환 없이 실패 사유만 기록 (키/네트워크 계열 오류)"""
        with self._lock:
            self._state.failures[model] = reason

    def reset(self, reason: str = "일일 초기화 (KST 00:00)") -> str:
        """1순위로 초기화"""
        with self._lock:
            was = self.active_model if self.chain else settings.AI_GATEWAY_MODEL
            self._state = RotationState()
            now = self.active_model if self.chain else settings.AI_GATEWAY_MODEL
            if was != now:
                logger.info(f"[ModelRotation] 모델 순위 초기화: {was} → {now} — {reason}")
            else:
                logger.info(f"[ModelRotation] 모델 순위 1순위 정상 유지 ({now}) — {reason}")
            return now


# 프로세스 전역 싱글턴 — 여러 AiGatewayClient 인스턴스가 공유한다.
model_rotation = ModelRotation()