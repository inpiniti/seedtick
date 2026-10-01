"""
AI 직접 호출 연결 테스트 엔드포인트
배포 환경(HuggingFace)에서 OpenRouter 직접 접근 및 키 로테이션 상태 확인용

GET /debug/ai-direct   — AiGatewayClient 실전 호출 테스트 (429 자동 로테이션 포함)
GET /debug/ai-keys     — 등록된 각 API 키별 쿼터 상태(200 vs 429) 개별 점검
GET /debug/ai-gateway  — 기존 Vercel 게이트웨이 호출 (비교용)
"""
import time
import logging
import httpx
from fastapi import APIRouter

from app.config.settings import settings
from app.domains.report.ai_client import AiGatewayClient

logger = logging.getLogger("debug_ai")
router = APIRouter(prefix="/debug", tags=["debug"])

_DIRECT_URL = "https://openrouter.ai/api/v1/chat/completions"
_TEST_PROMPT = "애플(AAPL)의 현재 PER이 높은지 낮은지 한 문장으로 평가해라."


@router.get("/ai-direct", summary="OpenRouter 직접 호출 테스트 (키 로테이션 적용)")
async def test_ai_direct():
    """
    실제 운영 클라이언트(AiGatewayClient)를 사용하여 OpenRouter를 호출합니다.
    429인 키는 건너뛰고 유효한 키로 자동 스위칭하여 결과를 반환합니다.
    """
    start = time.time()
    try:
        client = AiGatewayClient()
        content = await client.chat(_TEST_PROMPT, max_tokens=1000)
        elapsed = round(time.time() - start, 2)
        return {
            "ok": True,
            "mode": "direct" if client.use_direct else "gateway",
            "model": client.model,
            "chain": (
                [f"{p.name}({len(p.keys)}키)" for p in client.active_providers]
                if client.use_direct
                else ["AI-Gateway"]
            ),
            "keys_count": len(client.api_keys),
            "elapsed_sec": elapsed,
            "content": content,
            "error": None,
        }
    except Exception as e:
        elapsed = round(time.time() - start, 2)
        return {
            "ok": False,
            "elapsed_sec": elapsed,
            "error": str(e),
        }


@router.get("/ai-model", summary="현재 활성 AI 모델 및 순위 체인 상태")
async def get_ai_model():
    """
    현재 사용 중인 AI 모델과 순위 체인 상태를 반환합니다.

    1순위 모델이 프로바이더 과부하로 실패하면 자동으로 다음 순위로 내려가며,
    매일 00:01 KST에 1순위로 초기화됩니다. admin 화면이 이 값을 폴링해 표시합니다.
    """
    from app.domains.report.model_rotation import model_rotation

    snap = model_rotation.snapshot()
    return {
        "ok": True,
        "active_model": snap["active_model"],
        "active_index": snap["active_index"],
        "is_first": snap["is_first"],
        "chain": snap["chain"],
        "switch_count": snap["switch_count"],
        "switched_at": snap["switched_at"],
        "last_reason": snap["last_reason"],
        "failures": snap["failures"],
        "next_reset_at": snap["next_reset_at"],
        # 모델별 연속/누적 실패 횟수와 프로모션 백오프(복구 예정 시각)
        "health": snap["health"],
        "failure_threshold": settings.AI_MODEL_FAILURE_THRESHOLD,
        "promotion_cooldown_sec": settings.AI_MODEL_PROMOTION_COOLDOWN_SEC,
        "configured_model": settings.AI_GATEWAY_MODEL,
    }


@router.post("/ai-model/reset", summary="AI 모델 순위 1순위 수동 초기화")
async def reset_ai_model():
    """모델 순위를 1순위로 즉시 되돌립니다."""
    from app.domains.report.model_rotation import model_rotation

    before = model_rotation.snapshot()["active_model"]
    active = model_rotation.reset("admin 수동 초기화")
    return {
        "ok": True,
        "previous_model": before,
        "active_model": active,
        "chain": model_rotation.snapshot()["chain"],
    }


@router.get("/ai-keys", summary="등록된 OpenRouter API 키 상태 개별 점검")
async def test_ai_keys():
    """
    OPENROUTER_API_KEYS에 등록된 모든 키의 현재 쿼터/레이트리밋 상태를 개별 테스트합니다.
    """
    raw_keys = settings.OPENROUTER_API_KEYS or ""
    keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    if not keys:
        return {"ok": False, "error": "OPENROUTER_API_KEYS 설정이 비어 있습니다.", "keys": []}

    results = []
    for idx, key in enumerate(keys, 1):
        masked = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "invalid"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://seedtick.app",
            "X-Title": "SeedTick Analyzer",
        }
        payload = {
            "model": settings.AI_GATEWAY_MODEL,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 10,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(_DIRECT_URL, json=payload, headers=headers)
                body = res.json()
                results.append({
                    "index": idx,
                    "key": masked,
                    "http_status": res.status_code,
                    "ok": res.status_code == 200,
                    "error_msg": body.get("error", {}).get("message") if res.status_code != 200 else None,
                })
        except Exception as e:
            results.append({
                "index": idx,
                "key": masked,
                "http_status": 0,
                "ok": False,
                "error_msg": str(e),
            })

    total_valid = sum(1 for r in results if r["ok"])
    return {
        "ok": total_valid > 0,
        "model": settings.AI_GATEWAY_MODEL,
        "total_keys": len(keys),
        "valid_keys": total_valid,
        "keys_status": results,
    }


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
    payload = {
        "model": settings.AI_GATEWAY_MODEL,
        "messages": [{"role": "user", "content": _TEST_PROMPT}],
        "max_tokens": 1000,
        "temperature": 0.3,
    }
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(url, json=payload, headers=headers)
        elapsed = round(time.time() - start, 2)
        body = res.json()
        content = body.get("choices", [{}])[0].get("message", {}).get("content")
        return {
            "ok": res.status_code == 200,
            "mode": "gateway",
            "http_status": res.status_code,
            "elapsed_sec": elapsed,
            "content": content,
            "error": body.get("error"),
        }
    except Exception as e:
        return {"ok": False, "mode": "gateway", "error": str(e)}
