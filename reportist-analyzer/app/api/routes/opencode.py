"""Vercel 게이트웨이 → 로컬 OpenCode 사이드카 스트림 브릿지."""
import hmac
import logging
from collections.abc import AsyncIterator
from contextlib import AsyncExitStack
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.config.settings import settings
from app.domains.opencode.sidecar import opencode_sidecar

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/opencode", tags=["opencode"])


def _authorize(authorization: str | None) -> None:
    if not settings.AI_GATEWAY_SECRET:
        raise HTTPException(status_code=503, detail="gateway secret not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    if not hmac.compare_digest(authorization[7:], settings.AI_GATEWAY_SECRET):
        raise HTTPException(status_code=401, detail="invalid bearer token")


@router.get("/health", summary="OpenCode 사이드카 상태")
async def opencode_health() -> dict[str, Any]:
    return {
        "enabled": settings.OPENCODE_SHIM_ENABLED,
        "running": opencode_sidecar.running,
        "pid": opencode_sidecar.pid,
        "url": settings.OPENCODE_SHIM_URL,
    }


@router.post("/v1/chat/completions", summary="OpenCode 무료 모델 Chat Completions 브릿지")
async def opencode_chat_completions(
    request: Request,
    authorization: str | None = Header(default=None),
    x_opencode_api_key: str | None = Header(default=None),
) -> Any:
    _authorize(authorization)
    if not x_opencode_api_key:
        raise HTTPException(status_code=400, detail="x-opencode-api-key header required")
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid json") from exc
    if not isinstance(payload, dict) or not str(payload.get("model", "")).startswith("opencode/"):
        raise HTTPException(status_code=400, detail="model must start with opencode/")

    url = f"{settings.OPENCODE_SHIM_URL.rstrip('/')}/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "X-OpenCode-Api-Key": x_opencode_api_key,
    }
    if settings.AI_GATEWAY_SECRET:
        headers["Authorization"] = f"Bearer {settings.AI_GATEWAY_SECRET}"

    if not payload.get("stream"):
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(url, json=payload, headers=headers)
        return JSONResponse(response.json(), status_code=response.status_code)

    # 상태 코드 확인은 스트림 응답을 만들기 전에 해야 한다. StreamingResponse가
    # 한 번 시작되면 200 헤더가 이미 나가므로 그 안에서 에러를 뱉을 수 없다.
    stack = AsyncExitStack()
    try:
        client = await stack.enter_async_context(httpx.AsyncClient(timeout=None))
        response = await stack.enter_async_context(
            client.stream("POST", url, json=payload, headers=headers)
        )
    except Exception as exc:
        await stack.aclose()
        logger.warning("OpenCode sidecar stream failed to start: %s", exc)
        raise HTTPException(status_code=503, detail="OpenCode sidecar unavailable") from exc

    if response.status_code >= 400:
        body = await response.aread()
        await stack.aclose()
        try:
            detail: Any = response.json()
        except Exception:
            detail = body.decode("utf-8", errors="replace")
        return JSONResponse(detail, status_code=response.status_code)

    async def events() -> AsyncIterator[bytes]:
        async with stack:
            async for line in response.aiter_lines():
                yield (line + "\n").encode("utf-8")

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
