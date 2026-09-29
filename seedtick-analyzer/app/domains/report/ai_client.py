"""
AI-Gateway 연동 클라이언트 (OpenAI Chat Completions 규격)
"""
import asyncio
import logging
import httpx

from app.config.settings import settings

logger = logging.getLogger("ai_gateway_client")


class AiGatewayClient:
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
        secret: str | None = None,
        max_tokens: int | None = None,
    ):
        self.base_url = (base_url or settings.AI_GATEWAY_URL).rstrip("/")
        self.model = model or settings.AI_GATEWAY_MODEL
        self.timeout = timeout or settings.AI_GATEWAY_TIMEOUT
        self.secret = secret if secret is not None else settings.AI_GATEWAY_SECRET
        self.max_tokens = max_tokens or settings.AI_GATEWAY_MAX_TOKENS

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

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "seedtick-analyzer/0.1.0",
        }
        if self.secret:
            headers["Authorization"] = f"Bearer {self.secret}"

        # 최대 5회 재시도 (무료 티어 429 레이트리밋 대비 백오프 강화)
        max_attempts = 5
        for attempt in range(1, max_attempts + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    res = await client.post(url, json=payload, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        choices = data.get("choices", [])
                        if not choices:
                            # 게이트웨이가 200이지만 빈 choices 반환 (충돌/타임아웃 후 복구)
                            logger.warning(
                                f"[AiGateway] ⚠️ 200 OK 이지만 choices[] 빈 배열 — 재시도 ({attempt}/{max_attempts})"
                            )
                            if attempt < max_attempts:
                                await asyncio.sleep(2 * attempt)
                            continue
                        choice = choices[0]
                        content = choice.get("message", {}).get("content", "")
                        finish_reason = choice.get("finish_reason", "stop")
                        if finish_reason == "length":
                            usage = data.get("usage", {})
                            logger.debug(
                                f"[AiGateway] finish_reason=length — 응답이 max_tokens에 도달 "
                                f"(completion_tokens={usage.get('completion_tokens', '?')}, "
                                f"total_tokens={usage.get('total_tokens', '?')})"
                            )
                        if not content or not content.strip():
                            logger.warning(
                                f"[AiGateway] ⚠️ 200 OK 이지만 message.content가 비어있음 (finish_reason={finish_reason}) — 재시도 ({attempt}/{max_attempts})"
                            )
                            if attempt < max_attempts:
                                await asyncio.sleep(2 * attempt)
                            continue
                        return content.strip()

                    # 429 Too Many Requests인 경우 무료 티어 쿼터 리셋을 위해 넉넉한 대기시간 적용
                    if res.status_code == 429:
                        retry_after = res.headers.get("Retry-After")
                        if retry_after and retry_after.isdigit():
                            wait_sec = int(retry_after) + 1
                        else:
                            wait_sec = 6 * attempt  # 6초, 12초, 18초, 24초, 30초
                        logger.warning(
                            f"[AiGateway] 429 RateLimit 감지 — {wait_sec}초 대기 후 재시도 ({attempt}/{max_attempts})"
                        )
                        await asyncio.sleep(wait_sec)
                        continue

                    logger.warning(
                        f"[AiGateway] HTTP {res.status_code}: {res.text[:150]} (시도 {attempt}/{max_attempts})"
                    )
            except Exception as e:
                logger.warning(f"[AiGateway] 연결 오류 ({e}) - 시도 {attempt}/{max_attempts}")

            if attempt < max_attempts:
                await asyncio.sleep(2 * attempt)

        raise RuntimeError(f"AI-Gateway 응답 실패 (총 {max_attempts}회 시도 초과): {url}")
