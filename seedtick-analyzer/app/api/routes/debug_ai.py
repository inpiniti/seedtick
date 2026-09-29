"""
AI 직접 호출 연결 테스트 엔드포인트
배포 환경(HuggingFace)에서 OpenRouter 직접 접근 가능 여부 확인용

GET /debug/ai-direct   — OpenRouter 직접 호출
GET /debug/ai-gateway  — 기존 Vercel 게이트웨이 호출 (비교용)
"""
import time
import logging
import httpx
from fastapi import APIRouter

from app.config.settings import settings

logger = logging.getLogger("debug_ai")
router = APIRouter(prefix="/debug", tags=["debug"])

# OpenRouter 직접 호출용 키 (게이트웨이 .env의 첫 번째 키 사용)
# 실제 운영 전환 시 settings로 이관
_OPENROUTER_KEYS = [
    k.strip()
    for k in (settings.OPENROUTER_API_KEYS if hasattr(settings, "OPENROUTER_API_KEYS") else "").split(",")
    if k.strip()
]
_DIRECT_URL = "https://openrouter.ai/api/v1/chat/completions"
_TEST_PROMPT = "애플(AAPL)의 현재 PER이 높은지 낮은지 한 문장으로 평가해라."
_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
_MAX_TOKENS = 1000


async def _call(url: str, headers: dict) -> dict:
    payload = {
        "model": _MODEL,
        "messages": [{"role": "user", "content": _TEST_PROMPT}],
        "max_tokens": _MAX_TOKENS,
        "temperature": 0.3,
    }
    start = time.time()
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(url, json=payload, headers=headers)
    elapsed = round(time.time() - start, 2)
    body = res.json()
    try:
        content = body["choices"][0]["message"]["content"]
        finish = body["choices"][0].get("finish_reason", "?")
    except Exception:
        content = None
        finish = None
    usage = body.get("usage", {})
    return {
        "http_status": res.status_code,
        "elapsed_sec": elapsed,
        "finish_reason": finish,
        "usage": usage,
        "content_preview": content[:150] if content else None,
        "error": body.get("error"),
    }


@router.get("/ai-direct", summary="OpenRouter 직접 호출 테스트")
async def test_ai_direct():
    """
    HuggingFace 배포 환경에서 OpenRouter를 직접 호출할 수 있는지 확인합니다.
    settings에 OPENROUTER_API_KEYS가 없으면 error 반환.
    """
    if not _OPENROUTER_KEYS:
        return {
            "ok": False,
            "error": "OPENROUTER_API_KEYS 환경변수가 설정되지 않았습니다.",
        }

    api_key = _OPENROUTER_KEYS[0]
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://seedtick.vercel.app",
        "X-Title": "SeedTick Analyzer",
    }
    logger.info("[debug] OpenRouter 직접 호출 테스트 시작")
    try:
        result = await _call(_DIRECT_URL, headers)
        result["ok"] = result["http_status"] == 200
        result["mode"] = "direct"
        return result
    except Exception as e:
        return {"ok": False, "mode": "direct", "error": str(e)}


@router.get("/ai-gateway", summary="기존 Vercel 게이트웨이 호출 테스트 (비교용)")
async def test_ai_gateway():
    """기존 Vercel 게이트웨이 경유 호출과 응답 시간을 비교합니다."""
    url = f"{settings.AI_GATEWAY_URL}"
    if not url.endswith("/chat/completions"):
        url = url.rstrip("/") + "/v1/chat/completions" if "/v1" not in url else url
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.AI_GATEWAY_SECRET}",
    }
    logger.info("[debug] Vercel 게이트웨이 호출 테스트 시작")
    try:
        result = await _call(url, headers)
        result["ok"] = result["http_status"] == 200
        result["mode"] = "gateway"
        return result
    except Exception as e:
        return {"ok": False, "mode": "gateway", "error": str(e)}
