"""
AI 연동 클라이언트: 멀티 프로바이더 직접 호출 (OpenRouter, Cline, Kilo 교차 통합 로테이션 풀) 및 AI-Gateway 폴백
"""
import asyncio
from dataclasses import dataclass, field
import logging
import os
from typing import Any
import httpx

from app.config.settings import settings
from app.domains.report.model_rotation import model_rotation

logger = logging.getLogger("ai_client")


# 모델 레벨 실패로 판정해 다음 순위로 내려가야 하는 HTTP 상태 코드.
# (키 쿼터/네트워크 문제는 429/예외이므로 여기에 포함하지 않는다)
_MODEL_LEVEL_HTTP = {500, 502, 503, 504, 529}

# 모델 레벨 실패를 확정하는 에러 메시지 패턴 (소문자 비교)
_MODEL_LEVEL_PATTERNS = (
    "service temporarily overloaded",
    "temporarily overloaded",
    "overloaded",
    "upstream error",
    "upstream unavailable",
    "upstream service",
    "no such model",
    "model not found",
    "does not exist",
    "model is not available",
    "no available",
    "temporarily unavailable",
)


def _is_model_level_failure(
    status_code: int | None = None,
    error_code: Any = None,
    error_message: str | None = None,
    body: str | None = None,
) -> tuple[bool, str]:
    """
    모델 레벨 실패인지 판별하고, 로깅용 사유 문자열을 반환한다.

    키가 여러 개 있어도 해결되지 않는 문제(프로바이더 과부하, 모델 철수 등)만
    True 를 반환해 순위 체인을 다음 단계로 내려가게 한다.
    """
    if status_code is not None and status_code in _MODEL_LEVEL_HTTP:
        return True, f"HTTP {status_code}"

    # OpenRouter 는 200 OK 안쪽에 {"error": {"code": 503, ...}} 로 에러를 넣는다
    if error_code is not None:
        try:
            code_int = int(error_code)
        except (TypeError, ValueError):
            code_int = None
        if code_int is not None and code_int in _MODEL_LEVEL_HTTP:
            return True, f"code={error_code}"

    haystack = f"{error_message or ''} {body or ''}".lower()
    for pattern in _MODEL_LEVEL_PATTERNS:
        if pattern in haystack:
            return True, f"msg='{pattern}'"

    return False, ""


def _parse_keys(keys_str: str | None) -> list[str]:
    if not keys_str:
        return []
    return [k.strip() for k in keys_str.split(",") if k.strip()]


@dataclass
class KeySlot:
    """단일 API 키 및 제공사 정보 슬롯"""

    provider: str
    base_url: str
    key: str
    default_headers: dict[str, str] = field(default_factory=dict)


def _build_interleaved_slots(providers: list["LLMProvider"]) -> list[KeySlot]:
    """
    각 제공사의 키들을 교차(Interleaving) 배치하여
    요청들이 특정 제공사에 쏠리지 않고 골고루 분산되도록 통합 슬롯 풀을 구성합니다.
    예: [OR_1, Cline_1, Kilo_1, OR_2, Cline_2, Kilo_2, ...]
    """
    slots: list[KeySlot] = []
    provider_key_queues = [[(p, k) for k in p.keys] for p in providers if p.keys]
    while any(provider_key_queues):
        for q in provider_key_queues:
            if q:
                p, k = q.pop(0)
                slots.append(
                    KeySlot(
                        provider=p.name,
                        base_url=p.base_url,
                        key=k,
                        default_headers=p.default_headers,
                    )
                )
    return slots


class LLMProvider:
    """단일 LLM 제공사(Provider) 설정 및 키 라운드로빈 관리"""

    def __init__(
        self,
        name: str,
        base_url: str,
        keys: list[str],
        default_headers: dict[str, str] | None = None,
    ):
        self.name = name
        self.base_url = base_url
        self.keys = keys
        self.default_headers = default_headers or {}
        self._key_index = 0
        self._lock = asyncio.Lock()

    async def get_next_key(self) -> str | None:
        if not self.keys:
            return None
        async with self._lock:
            key = self.keys[self._key_index % len(self.keys)]
            self._key_index += 1
            return key


class AiGatewayClient:
    """
    OpenAI Chat Completions 규격 멀티 프로바이더 클라이언트
    - 1순위: OpenRouter 직접 호출 (다중 키 라운드로빈 로테이션)
    - 2순위: Cline 폴백 (다중 키 라운드로빈 로테이션)
    - 3순위: Kilo 폴백 (다중 키 라운드로빈 로테이션)
    - 4순위: 직접 호출 키가 없을 경우 settings.AI_GATEWAY_URL (Vercel 게이트웨이) 경유
    """

    _key_index: int = 0
    _key_lock: asyncio.Lock = asyncio.Lock()

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
        secret: str | None = None,
        max_tokens: int | None = None,
        api_keys: list[str] | None = None,
        cline_keys: list[str] | None = None,
        kilo_keys: list[str] | None = None,
    ):
        self._model_override = model
        self.timeout = timeout or settings.AI_GATEWAY_TIMEOUT
        self.max_tokens = max_tokens or settings.AI_GATEWAY_MAX_TOKENS
        self.secret = secret if secret is not None else settings.AI_GATEWAY_SECRET

        # 1. OpenRouter 키 초기화
        if api_keys is not None:
            openrouter_keys = api_keys
        else:
            openrouter_keys = _parse_keys(
                settings.OPENROUTER_API_KEYS
                or settings.OPENROUTER_API_KEY
                or os.environ.get("OPENROUTER_API_KEYS")
                or os.environ.get("OPENROUTER_API_KEY")
            )

        # 2. Cline 키 초기화
        if cline_keys is not None:
            c_keys = cline_keys
        else:
            c_keys = _parse_keys(
                settings.CLINE_API_KEYS
                or settings.CLINE_API_KEY
                or os.environ.get("CLINE_API_KEYS")
                or os.environ.get("CLINE_API_KEY")
            )

        # 3. Kilo 키 초기화
        if kilo_keys is not None:
            k_keys = kilo_keys
        else:
            k_keys = _parse_keys(
                settings.KILO_API_KEYS
                or settings.KILO_API_KEY
                or os.environ.get("KILO_API_KEYS")
                or os.environ.get("KILO_API_KEY")
            )

        # 제공사 인스턴스 생성
        self.openrouter = LLMProvider(
            name="OpenRouter",
            base_url="https://openrouter.ai/api/v1/chat/completions",
            keys=openrouter_keys,
            default_headers={
                "HTTP-Referer": "https://seedtick.app",
                "X-Title": "SeedTick Analyzer",
            },
        )
        self.cline = LLMProvider(
            name="Cline",
            base_url="https://api.cline.bot/api/v1/chat/completions",
            keys=c_keys,
        )
        self.kilo = LLMProvider(
            name="Kilo",
            base_url="https://api.kilo.ai/api/gateway/chat/completions",
            keys=k_keys,
        )

        # 하위 호환성 (기존 테스트 및 속성 참조)
        self.api_keys = openrouter_keys

        # 체인/슬롯 목록 (키가 존재하는 활성 제공사만 포함)
        all_providers = [self.openrouter, self.cline, self.kilo]
        self.active_providers = [p for p in all_providers if p.keys]

        # 27개 키 등 전체 제공사의 키를 교차(Interleaving) 배치한 통합 로테이션 슬롯 풀 구성
        self.slots: list[KeySlot] = _build_interleaved_slots(self.active_providers)
        self._slot_index: int = 0
        self._slot_lock: asyncio.Lock = asyncio.Lock()

        # 작동 모드 판별
        if base_url:
            self.base_url = base_url.rstrip("/")
            self.use_direct = False
        elif self.slots:
            self.base_url = self.slots[0].base_url
            self.use_direct = True
        else:
            self.base_url = settings.AI_GATEWAY_URL.rstrip("/")
            self.use_direct = False

        provider_summary = ", ".join(f"{p.name}({len(p.keys)}키)" for p in self.active_providers)
        logger.info(
            f"[AiClient] 초기화 완료: 모드={'통합 로테이션 풀 직접호출' if self.use_direct else 'AI-Gateway 경유'}, "
            f"활성 풀=총 {len(self.slots)}개 슬롯 ({provider_summary if provider_summary else '키 없음'}), "
            f"모델={self.model}, 기본 max_tokens={self.max_tokens}, 타임아웃={self.timeout}s"
        )

    @property
    def model(self) -> str:
        """
        현재 사용할 모델.

        생성자에 model을 명시적으로 넘긴 경우에만 그 값을 고정 사용하고,
        그렇지 않으면 순위 체인의 활성 모델을 매번 읽는다(순위 전환 반영).
        """
        return self._model_override or model_rotation.active_model

    @model.setter
    def model(self, value: str) -> None:
        self._model_override = value

    async def _get_next_slot(self) -> KeySlot | None:
        """통합 슬롯 풀에서 다음 키 슬롯을 라운드로빈 방식으로 획득"""
        if not self.slots:
            return None
        async with self._slot_lock:
            slot = self.slots[self._slot_index % len(self.slots)]
            self._slot_index += 1
            return slot

    async def _get_next_key(self) -> str | None:
        """하위 호환용: 다음 키 슬롯의 API 키 반환"""
        slot = await self._get_next_slot()
        return slot.key if slot else None

    async def chat(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int | None = None,
    ) -> str:
        """
        채pletion 호출.

        요청 시점의 활성 모델(model_rotation.active_model)을 사용하고,
        모델 레벨 실패(프로바이더 과부하 등)가 감지되면 순위 체인의 다음 단계로
        자동 전환한 뒤 재시도한다. 키 쿼터(429)나 네트워크 오류는 모델을
        바꾸지 않고 다음 슬롯(키)으로만 넘어간다.

        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        tokens_to_request = max_tokens if max_tokens is not None else self.max_tokens

        # 활성 모델을 요청 시점에 확정 (동시 호출 간 순위 전환 영향 최소화)
        model = self.model or model_rotation.active_model
        payload = {
            "model": model,
            "messages": messages,
            "temperature": settings.AI_GATEWAY_TEMPERATURE,
            "max_tokens": tokens_to_request,
        }

        # ── 1. 직접 호출 모드 (통합 슬롯 풀 교차 라운드로빈 로테이션) ──
        if self.use_direct and self.slots:
            max_attempts = max(3, len(self.slots))
            logger.info(
                f"[AiClient] 🚀 통합 풀 호출 시작 (총 {len(self.slots)}개 슬롯 교차 로테이션, 최대 {max_attempts}회 시도)"
            )

            for attempt in range(1, max_attempts + 1):
                slot = await self._get_next_slot()
                if not slot:
                    break

                current_key = slot.key
                key_masked = (
                    f"{current_key[:8]}...{current_key[-4:]}"
                    if current_key and len(current_key) > 12
                    else "invalid"
                )

                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "seedtick-analyzer/0.2.0",
                    "Authorization": f"Bearer {current_key}",
                    **slot.default_headers,
                }

                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        res = await client.post(
                            slot.base_url, json=payload, headers=headers
                        )

                        if res.status_code == 200:
                            try:
                                data = res.json()
                            except Exception as json_err:
                                logger.warning(
                                    f"[AiClient] ⚠️ [{slot.provider}] 200 OK 이지만 JSON 파싱 실패 ({json_err}) "
                                    f"(키: {key_masked}) — 본문: {res.text[:200]} — 다음 슬롯으로 재시도 ({attempt}/{max_attempts})"
                                )
                                if attempt < max_attempts:
                                    await asyncio.sleep(0.5)
                                continue

                            # 0) Cline 등 일부 제공자가 {"data": {"choices": [...]}} 형태로 감싸서 반환한 경우 언래핑
                            if isinstance(data.get("data"), dict) and (
                                "choices" in data["data"] or "error" in data["data"]
                            ):
                                data = data["data"]

                            # 1) OpenRouter 등 상위 제공자가 200 OK 내에 error 객체를 반환한 경우
                            if "error" in data and isinstance(data["error"], dict):
                                err_info = data["error"]
                                err_code = err_info.get("code", "unknown")
                                err_msg = err_info.get("message", str(err_info))

                                # 모델 레벨 실패면 순위 체인의 다음 단계로 전환
                                is_model_level, why = _is_model_level_failure(
                                    error_code=err_code, error_message=err_msg
                                )
                                if is_model_level:
                                    failed_model = model
                                    new_model = model_rotation.advance(
                                        failed_model, f"{failed_model} → ({err_code}) {err_msg}"
                                    )
                                    payload["model"] = new_model
                                    model = new_model
                                    logger.warning(
                                        f"[AiClient] ⚠️ [{slot.provider}] 모델 과부하/불가로 순위 전환 "
                                        f"(model={failed_model}, code={err_code}, msg={err_msg}) "
                                        f"→ 다음 모델={new_model} (키: {key_masked}) "
                                        f"— 계속 시도 ({attempt}/{max_attempts})"
                                    )
                                else:
                                    logger.warning(
                                        f"[AiClient] ⚠️ [{slot.provider}] 200 OK 내부에 error 필드 감지 "
                                        f"(code={err_code}, msg={err_msg}) (키: {key_masked}) — 다음 슬롯으로 재시도 ({attempt}/{max_attempts})"
                                    )
                                if attempt < max_attempts:
                                    await asyncio.sleep(0.5)
                                continue

                            # 2) choices[] 빈 배열 검사 (원인 로그 상세 출력 후 재시도)
                            choices = data.get("choices", [])
                            if not choices:
                                raw_body = res.text[:300].strip()
                                # 빈 응답도 모델 레벨 문제일 수 있음 (과부하 시 정상 동작)
                                is_model_level, why = _is_model_level_failure(body=raw_body)
                                if is_model_level:
                                    failed_model = model
                                    new_model = model_rotation.advance(
                                        failed_model, f"{failed_model} → (빈 응답) {raw_body[:120]}"
                                    )
                                    payload["model"] = new_model
                                    model = new_model
                                    logger.warning(
                                        f"[AiClient] ⚠️ [{slot.provider}] 빈 응답 + 모델 레벨 오류로 순위 전환 "
                                        f"(model={failed_model}, 사유={why}) → 다음 모델={new_model} "
                                        f"— 계속 시도 ({attempt}/{max_attempts})"
                                    )
                                else:
                                    logger.warning(
                                        f"[AiClient] ⚠️ [{slot.provider}] 200 OK 이지만 choices[] 빈 배열 (키: {key_masked}) "
                                        f"— 응답 본문: {raw_body} — 다음 슬롯으로 재시도 ({attempt}/{max_attempts})"
                                    )
                                if attempt < max_attempts:
                                    await asyncio.sleep(0.5)
                                continue

                            choice = choices[0]
                            message_obj = choice.get("message", {})
                            content = message_obj.get("content", "")
                            finish_reason = choice.get("finish_reason", "stop")

                            # Thinking 모델 대응: content가 비어 있고 reasoning/reasoning_content가 있을 경우 채택
                            if not content or not content.strip():
                                reasoning = message_obj.get("reasoning") or message_obj.get(
                                    "reasoning_content"
                                )
                                if reasoning and isinstance(reasoning, str) and reasoning.strip():
                                    content = reasoning

                            if finish_reason == "length":
                                usage = data.get("usage", {})
                                logger.warning(
                                    f"[AiClient] ⚠️ [{slot.provider}] finish_reason=length — 응답이 토큰 한도로 잘림! "
                                    f"completion_tokens={usage.get('completion_tokens', '?')} "
                                    f"total_tokens={usage.get('total_tokens', '?')}"
                                )

                            if not content or not content.strip():
                                logger.warning(
                                    f"[AiClient] ⚠️ [{slot.provider}] 200 OK 이지만 message.content가 비어있음 "
                                    f"(finish_reason={finish_reason}, keys={list(message_obj.keys())}) (키: {key_masked}) "
                                    f"— 다음 슬롯으로 재시도 ({attempt}/{max_attempts})"
                                )
                                if attempt < max_attempts:
                                    await asyncio.sleep(0.5)
                                continue

                            # 성공 완료 — 연속 실패 카운터/프로모션 백오프 해제
                            model_rotation.note_success(model)
                            return content.strip()

                        # 429 RateLimit 대응: 쿨다운 없이 즉시 다음 슬롯으로 순환 전환
                        if res.status_code == 429:
                            logger.warning(
                                f"[AiClient] 429 RateLimit 감지 ([{slot.provider}], 키: {key_masked}) "
                                f"-> 다음 슬롯으로 즉시 전환 (시도 {attempt}/{max_attempts})"
                            )
                            continue

                        # 503/500 등 모델 레벨 HTTP 에러 → 순위 전환 후 재시도
                        is_model_level, why = _is_model_level_failure(
                            status_code=res.status_code, body=res.text[:180]
                        )
                        if is_model_level:
                            failed_model = model
                            new_model = model_rotation.advance(
                                failed_model, f"{failed_model} → HTTP {res.status_code}"
                            )
                            payload["model"] = new_model
                            model = new_model
                            logger.warning(
                                f"[AiClient] ⚠️ [{slot.provider}] HTTP {res.status_code} "
                                f"(사유={why}) → 모델 순위 전환 {failed_model} → {new_model} "
                                f"(키: {key_masked}) — 계속 시도 ({attempt}/{max_attempts})"
                            )
                            if attempt < max_attempts:
                                await asyncio.sleep(0.5)
                            continue

                        # 기타 HTTP 에러
                        logger.warning(
                            f"[AiClient] HTTP {res.status_code} ([{slot.provider}], 키: {key_masked}): "
                            f"{res.text[:180]} (시도 {attempt}/{max_attempts})"
                        )

                except Exception as e:
                    logger.warning(
                        f"[AiClient] 연결 오류 ({e}) ([{slot.provider}], 키: {key_masked}) - "
                        f"시도 {attempt}/{max_attempts}"
                    )

                if attempt < max_attempts:
                    await asyncio.sleep(0.5)

            raise RuntimeError(
                f"모든 AI 슬롯 호출 실패 (총 {len(self.slots)}개 슬롯, {max_attempts}회 시도 소진)"
            )

        # ── 2. AI-Gateway (Vercel) 경유 모드 ──
        url = (
            self.base_url
            if "/v1/chat/completions" in self.base_url
            else f"{self.base_url}/v1/chat/completions"
        )
        max_attempts = 5

        for attempt in range(1, max_attempts + 1):
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "seedtick-analyzer/0.2.0",
            }
            if self.secret:
                headers["Authorization"] = f"Bearer {self.secret}"

            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    res = await client.post(url, json=payload, headers=headers)

                    if res.status_code == 200:
                        data = res.json()
                        # Cline 등 일부 제공자가 {"data": {"choices": [...]}} 형태로 감싸서 반환한 경우 언래핑
                        if isinstance(data.get("data"), dict) and (
                            "choices" in data["data"] or "error" in data["data"]
                        ):
                            data = data["data"]

                        if "error" in data and isinstance(data["error"], dict):
                            err_info = data["error"]
                            err_code = err_info.get("code", "unknown")
                            err_msg = err_info.get("message", str(err_info))
                            is_model_level, why = _is_model_level_failure(
                                error_code=err_code, error_message=err_msg
                            )
                            if is_model_level:
                                failed_model = model
                                new_model = model_rotation.advance(
                                    failed_model, f"{failed_model} → ({err_code}) {err_msg}"
                                )
                                payload["model"] = new_model
                                model = new_model
                                logger.warning(
                                    f"[AiClient] ⚠️ [AI-Gateway] 모델 레벨 오류로 순위 전환 "
                                    f"(code={err_code}, msg={err_msg}, model={failed_model}) "
                                    f"→ 다음 모델={new_model} — 재시도 ({attempt}/{max_attempts})"
                                )
                            else:
                                logger.warning(
                                    f"[AiClient] ⚠️ [AI-Gateway] 200 OK 내부에 error 필드 반환: {err_info} "
                                    f"— 재시도 ({attempt}/{max_attempts})"
                                )
                            if attempt < max_attempts:
                                await asyncio.sleep(2 * attempt)
                            continue

                        choices = data.get("choices", [])
                        if not choices:
                            raw_body = res.text[:300].strip()
                            is_model_level, why = _is_model_level_failure(body=raw_body)
                            if is_model_level:
                                failed_model = model
                                new_model = model_rotation.advance(
                                    failed_model, f"{failed_model} → (빈 응답) {raw_body[:120]}"
                                )
                                payload["model"] = new_model
                                model = new_model
                                logger.warning(
                                    f"[AiClient] ⚠️ [AI-Gateway] 빈 응답 + 모델 레벨 오류로 순위 전환 "
                                    f"(model={failed_model}, 사유={why}) → 다음 모델={new_model} "
                                    f"— 재시도 ({attempt}/{max_attempts})"
                                )
                            else:
                                logger.warning(
                                    f"[AiClient] ⚠️ [AI-Gateway] 200 OK 이지만 choices[] 빈 배열 — 응답: {raw_body} "
                                    f"— 재시도 ({attempt}/{max_attempts})"
                                )
                            if attempt < max_attempts:
                                await asyncio.sleep(2 * attempt)
                            continue

                        choice = choices[0]
                        message_obj = choice.get("message", {})
                        content = message_obj.get("content", "")
                        finish_reason = choice.get("finish_reason", "stop")

                        if not content or not content.strip():
                            reasoning = message_obj.get("reasoning") or message_obj.get(
                                "reasoning_content"
                            )
                            if reasoning and isinstance(reasoning, str) and reasoning.strip():
                                content = reasoning

                        if finish_reason == "length":
                            usage = data.get("usage", {})
                            logger.warning(
                                f"[AiClient] ⚠️ [AI-Gateway] finish_reason=length — 응답이 토큰 한도로 잘림! "
                                f"completion_tokens={usage.get('completion_tokens', '?')} "
                                f"total_tokens={usage.get('total_tokens', '?')}"
                            )

                        if not content or not content.strip():
                            logger.warning(
                                f"[AiClient] ⚠️ [AI-Gateway] 200 OK 이지만 content 비어있음 — 재시도 ({attempt}/{max_attempts})"
                            )
                            if attempt < max_attempts:
                                await asyncio.sleep(2 * attempt)
                            continue

                        # 성공 — 연속 실패 카운터/프로모션 백오프 해제
                        model_rotation.note_success(model)
                        return content.strip()

                    if res.status_code == 429:
                        retry_after = res.headers.get("Retry-After")
                        wait_sec = (
                            int(retry_after) + 1
                            if retry_after and retry_after.isdigit()
                            else 6 * attempt
                        )
                        logger.warning(
                            f"[AiClient] [AI-Gateway] 429 RateLimit 감지 -> {wait_sec}초 대기 후 재시도 ({attempt}/{max_attempts})"
                        )
                        await asyncio.sleep(wait_sec)
                        continue

                    is_model_level, why = _is_model_level_failure(
                        status_code=res.status_code, body=res.text[:180]
                    )
                    if is_model_level:
                        failed_model = model
                        new_model = model_rotation.advance(
                            failed_model, f"{failed_model} → HTTP {res.status_code}"
                        )
                        payload["model"] = new_model
                        model = new_model
                        logger.warning(
                            f"[AiClient] [AI-Gateway] HTTP {res.status_code} (사유={why}) "
                            f"→ 모델 순위 전환 {failed_model} → {new_model} "
                            f"— 재시도 ({attempt}/{max_attempts})"
                        )
                    else:
                        logger.warning(
                            f"[AiClient] [AI-Gateway] HTTP {res.status_code}: {res.text[:180]} (시도 {attempt}/{max_attempts})"
                        )

            except Exception as e:
                logger.warning(
                    f"[AiClient] [AI-Gateway] 연결 오류 ({e}) - 시도 {attempt}/{max_attempts}"
                )

            if attempt < max_attempts:
                await asyncio.sleep(2 * attempt)

        raise RuntimeError(f"AI 호출 실패 (총 {max_attempts}회 시도 초과): {url}")
