"""
AI 연동 클라이언트: 멀티 프로바이더 직접 호출 (OpenRouter -> Cline -> Kilo 폴백 체인) 및 AI-Gateway 폴백
"""
import asyncio
import logging
import os
import httpx

from app.config.settings import settings

logger = logging.getLogger("ai_client")


def _parse_keys(keys_str: str | None) -> list[str]:
    if not keys_str:
        return []
    return [k.strip() for k in keys_str.split(",") if k.strip()]


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
        self.model = model or settings.AI_GATEWAY_MODEL
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

        # 체인 목록 (키가 존재하는 활성 제공사만 포함)
        all_providers = [self.openrouter, self.cline, self.kilo]
        self.active_providers = [p for p in all_providers if p.keys]

        # 작동 모드 판별
        if base_url:
            self.base_url = base_url.rstrip("/")
            self.use_direct = False
        elif self.active_providers:
            self.base_url = self.active_providers[0].base_url
            self.use_direct = True
        else:
            self.base_url = settings.AI_GATEWAY_URL.rstrip("/")
            self.use_direct = False

        chain_names = [f"{p.name}({len(p.keys)}키)" for p in self.active_providers]
        logger.info(
            f"[AiClient] 초기화 완료: 모드={'직접호출 체인' if self.use_direct else 'AI-Gateway 경유'}, "
            f"활성 체인={' -> '.join(chain_names) if chain_names else '없음(게이트웨이 폴백)'}, "
            f"모델={self.model}, 기본 max_tokens={self.max_tokens}, 타임아웃={self.timeout}s"
        )

    async def _get_next_key(self) -> str | None:
        """하위 호환용: OpenRouter(또는 첫 번째 활성 제공사)의 다음 키 반환"""
        if self.openrouter.keys:
            return await self.openrouter.get_next_key()
        if self.active_providers:
            return await self.active_providers[0].get_next_key()
        return None

    async def chat(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int | None = None,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        tokens_to_request = max_tokens if max_tokens is not None else self.max_tokens
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": tokens_to_request,
        }

        # ── 1. 직접 호출 모드 (OpenRouter -> Cline -> Kilo Fallback 체인) ──
        if self.use_direct and self.active_providers:
            for p_idx, provider in enumerate(self.active_providers, 1):
                max_attempts = max(3, len(provider.keys) * 2)
                logger.info(
                    f"[AiClient] 🚀 [{provider.name}] 호출 시작 (키 {len(provider.keys)}개, 최대 {max_attempts}회 시도)"
                )

                for attempt in range(1, max_attempts + 1):
                    current_key = await provider.get_next_key()
                    key_masked = (
                        f"{current_key[:8]}...{current_key[-4:]}"
                        if current_key and len(current_key) > 12
                        else "invalid"
                    )

                    headers = {
                        "Content-Type": "application/json",
                        "User-Agent": "seedtick-analyzer/0.2.0",
                        "Authorization": f"Bearer {current_key}",
                        **provider.default_headers,
                    }

                    try:
                        async with httpx.AsyncClient(timeout=self.timeout) as client:
                            res = await client.post(
                                provider.base_url, json=payload, headers=headers
                            )

                            if res.status_code == 200:
                                try:
                                    data = res.json()
                                except Exception as json_err:
                                    logger.warning(
                                        f"[AiClient] ⚠️ [{provider.name}] 200 OK 이지만 JSON 파싱 실패 ({json_err}) "
                                        f"(키: {key_masked}) — 본문: {res.text[:200]} — 재시도 ({attempt}/{max_attempts})"
                                    )
                                    if attempt < max_attempts:
                                        await asyncio.sleep(1.0 * attempt)
                                    continue

                                # 1) OpenRouter 등 상위 제공자가 200 OK 내에 error 객체를 반환한 경우
                                if "error" in data and isinstance(data["error"], dict):
                                    err_info = data["error"]
                                    err_code = err_info.get("code", "unknown")
                                    err_msg = err_info.get("message", str(err_info))
                                    logger.warning(
                                        f"[AiClient] ⚠️ [{provider.name}] 200 OK 내부에 error 필드 감지 "
                                        f"(code={err_code}, msg={err_msg}) (키: {key_masked}) — 재시도 ({attempt}/{max_attempts})"
                                    )
                                    if attempt < max_attempts:
                                        await asyncio.sleep(1.0 * attempt)
                                    continue

                                # 2) choices[] 빈 배열 검사 (원인 로그 상세 출력 후 재시도)
                                choices = data.get("choices", [])
                                if not choices:
                                    raw_body = res.text[:300].strip()
                                    logger.warning(
                                        f"[AiClient] ⚠️ [{provider.name}] 200 OK 이지만 choices[] 빈 배열 (키: {key_masked}) "
                                        f"— 응답 본문: {raw_body} — 재시도 ({attempt}/{max_attempts})"
                                    )
                                    if attempt < max_attempts:
                                        await asyncio.sleep(1.0 * attempt)
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
                                        f"[AiClient] ⚠️ [{provider.name}] finish_reason=length — 응답이 토큰 한도로 잘림! "
                                        f"completion_tokens={usage.get('completion_tokens', '?')} "
                                        f"total_tokens={usage.get('total_tokens', '?')}"
                                    )

                                if not content or not content.strip():
                                    logger.warning(
                                        f"[AiClient] ⚠️ [{provider.name}] 200 OK 이지만 message.content가 비어있음 "
                                        f"(finish_reason={finish_reason}, keys={list(message_obj.keys())}) (키: {key_masked}) "
                                        f"— 재시도 ({attempt}/{max_attempts})"
                                    )
                                    if attempt < max_attempts:
                                        await asyncio.sleep(1.0 * attempt)
                                    continue

                                # 성공 완료
                                return content.strip()

                            # 429 RateLimit 대응: 쿨다운 없이 다음 키로 순환 재시도
                            if res.status_code == 429:
                                logger.warning(
                                    f"[AiClient] 429 RateLimit 감지 ([{provider.name}], 키: {key_masked}) "
                                    f"-> 다음 키로 즉시 전환 (시도 {attempt}/{max_attempts})"
                                )
                                await asyncio.sleep(1.0)
                                continue

                            # 기타 HTTP 에러
                            logger.warning(
                                f"[AiClient] HTTP {res.status_code} ([{provider.name}], 키: {key_masked}): "
                                f"{res.text[:180]} (시도 {attempt}/{max_attempts})"
                            )

                    except Exception as e:
                        logger.warning(
                            f"[AiClient] 연결 오류 ({e}) ([{provider.name}], 키: {key_masked}) - "
                            f"시도 {attempt}/{max_attempts}"
                        )

                    if attempt < max_attempts:
                        await asyncio.sleep(1.0 * attempt)

                # 현재 프로바이더 실패 시 다음 프로바이더로 Fallback 전환
                if p_idx < len(self.active_providers):
                    next_p = self.active_providers[p_idx]
                    logger.warning(
                        f"[AiClient] 🔄 [{provider.name}] 모든 재시도({max_attempts}회) 소진 "
                        f"-> 다음 체인 제공사 [{next_p.name}]로 Fallback 전환!"
                    )

            raise RuntimeError(
                f"모든 AI 제공사 호출 실패 (체인: {[p.name for p in self.active_providers]})"
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
                        if "error" in data and isinstance(data["error"], dict):
                            err_info = data["error"]
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
