"""
AI 연동 클라이언트: OpenRouter 직접 호출 (다중 키 로테이션 지원) 및 AI-Gateway 폴백
"""
import asyncio
import logging
import httpx

from app.config.settings import settings

logger = logging.getLogger("ai_client")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class AiGatewayClient:
    """
    OpenAI Chat Completions 규격 클라이언트
    - 1순위: settings.OPENROUTER_API_KEYS 가 설정되어 있으면 OpenRouter 직접 호출
      (멀티 API 키 라운드로빈 로테이션 및 429 감지 시 즉시 다음 키로 전환)
    - 2순위: 키가 없으면 settings.AI_GATEWAY_URL (기존 Vercel 게이트웨이) 경유
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
    ):
        self.model = model or settings.AI_GATEWAY_MODEL
        self.timeout = timeout or settings.AI_GATEWAY_TIMEOUT
        self.max_tokens = max_tokens or settings.AI_GATEWAY_MAX_TOKENS

        # 1. OpenRouter 직접 호출 키 설정
        if api_keys is not None:
            self.api_keys = api_keys
        elif settings.OPENROUTER_API_KEYS:
            self.api_keys = [
                k.strip()
                for k in settings.OPENROUTER_API_KEYS.split(",")
                if k.strip()
            ]
        else:
            self.api_keys = []

        # 2. 직접 호출 여부 판별
        if base_url:
            self.base_url = base_url.rstrip("/")
            self.use_direct = False
        elif self.api_keys:
            self.base_url = OPENROUTER_URL
            self.use_direct = True
        else:
            self.base_url = settings.AI_GATEWAY_URL.rstrip("/")
            self.use_direct = False

        self.secret = secret if secret is not None else settings.AI_GATEWAY_SECRET
        logger.info(
            f"[AiClient] 초기화: 모드={'OpenRouter 직접호출' if self.use_direct else 'AI-Gateway 경유'}, "
            f"모델={self.model}, 키 개수={len(self.api_keys)}, 기본 max_tokens={self.max_tokens}, "
            f"타임아웃={self.timeout}s"
        )

    async def _get_next_key(self) -> str | None:
        if not self.api_keys:
            return None
        async with self._key_lock:
            key = self.api_keys[AiGatewayClient._key_index % len(self.api_keys)]
            AiGatewayClient._key_index += 1
            return key

    async def chat(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int | None = None,
    ) -> str:
        if "/v1/chat/completions" in self.base_url:
            url = self.base_url
        else:
            url = f"{self.base_url}/v1/chat/completions"

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

        # 최대 재시도 횟수 (키 개수의 2배, 최소 5회)
        max_attempts = max(5, len(self.api_keys) * 2) if self.api_keys else 5

        for attempt in range(1, max_attempts + 1):
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "seedtick-analyzer/0.2.0",
            }

            key_masked = "none"
            if self.use_direct:
                current_key = await self._get_next_key()
                if current_key:
                    headers["Authorization"] = f"Bearer {current_key}"
                    headers["HTTP-Referer"] = "https://seedtick.app"
                    headers["X-Title"] = "SeedTick Analyzer"
                    key_masked = f"{current_key[:8]}...{current_key[-4:]}"
            else:
                if self.secret:
                    headers["Authorization"] = f"Bearer {self.secret}"

            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    res = await client.post(url, json=payload, headers=headers)

                    if res.status_code == 200:
                        data = res.json()
                        choices = data.get("choices", [])
                        if not choices:
                            logger.warning(
                                f"[AiClient] ⚠️ 200 OK 이지만 choices[] 빈 배열 — 재시도 ({attempt}/{max_attempts})"
                            )
                            if attempt < max_attempts:
                                await asyncio.sleep(2 * attempt)
                            continue

                        choice = choices[0]
                        content = choice.get("message", {}).get("content", "")
                        finish_reason = choice.get("finish_reason", "stop")

                        if finish_reason == "length":
                            usage = data.get("usage", {})
                            logger.warning(
                                f"[AiClient] ⚠️ finish_reason=length — 응답이 토큰 한도로 잘림! "
                                f"completion_tokens={usage.get('completion_tokens', '?')} "
                                f"total_tokens={usage.get('total_tokens', '?')}"
                            )

                        if not content or not content.strip():
                            logger.warning(
                                f"[AiClient] ⚠️ 200 OK 이지만 message.content가 비어있음 (finish_reason={finish_reason}) — 재시도 ({attempt}/{max_attempts})"
                            )
                            if attempt < max_attempts:
                                await asyncio.sleep(2 * attempt)
                            continue

                        return content.strip()

                    # 429 RateLimit 대응
                    if res.status_code == 429:
                        if self.use_direct and len(self.api_keys) > 1:
                            # 다른 키가 있으므로 즉시 다음 키로 로테이션 재시도
                            logger.warning(
                                f"[AiClient] 429 RateLimit 감지 (키: {key_masked}) -> 다음 키로 즉시 전환 (시도 {attempt}/{max_attempts})"
                            )
                            await asyncio.sleep(1.0)
                            continue
                        else:
                            retry_after = res.headers.get("Retry-After")
                            wait_sec = (
                                int(retry_after) + 1
                                if retry_after and retry_after.isdigit()
                                else 6 * attempt
                            )
                            logger.warning(
                                f"[AiClient] 429 RateLimit 감지 (키: {key_masked}) -> {wait_sec}초 대기 후 재시도 ({attempt}/{max_attempts})"
                            )
                            await asyncio.sleep(wait_sec)
                            continue

                    logger.warning(
                        f"[AiClient] HTTP {res.status_code} (키: {key_masked}): {res.text[:180]} (시도 {attempt}/{max_attempts})"
                    )

            except Exception as e:
                logger.warning(
                    f"[AiClient] 연결 오류 ({e}) (키: {key_masked}) - 시도 {attempt}/{max_attempts}"
                )

            if attempt < max_attempts:
                await asyncio.sleep(2 * attempt)

        raise RuntimeError(f"AI 호출 실패 (총 {max_attempts}회 시도 초과): {url}")
