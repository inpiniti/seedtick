"""
OpenRouter 직접 호출 검증 스크립트
- 기존 ai-gateway(Vercel)를 거치지 않고 OpenRouter에 직접 호출
- 기존 analyzer 코드는 전혀 건드리지 않음
- 결과만 확인용

실행: python scripts/test_direct_ai.py
"""
import asyncio
import httpx
import os
import time

# ── 설정 ─────────────────────────────────────────────────
# 실행 전 환경변수 설정 필요:
#   export OPENROUTER_API_KEYS="sk-or-v1-xxx,sk-or-v1-yyy"
#   export GATEWAY_SECRET="your-gateway-secret"
_raw_keys = os.environ.get("OPENROUTER_API_KEYS", "")
OPENROUTER_API_KEYS = [k.strip() for k in _raw_keys.split(",") if k.strip()]
MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
DIRECT_URL = "https://openrouter.ai/api/v1/chat/completions"
GATEWAY_URL = "https://seedtick-ai-gateway.vercel.app/v1/chat/completions"
GATEWAY_SECRET = os.environ.get("GATEWAY_SECRET", "")

TEST_PROMPT = "애플(AAPL)의 현재 PER이 높은지 낮은지 한 문장으로 평가해라."
MAX_TOKENS = 300  # 빠른 응답 확인용


async def call_direct(api_key: str) -> dict:
    """OpenRouter 직접 호출"""
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": TEST_PROMPT}],
        "max_tokens": MAX_TOKENS,
        "temperature": 0.3,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://seedtick.vercel.app",
        "X-Title": "SeedTick Analyzer",
    }

    start = time.time()
    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(DIRECT_URL, json=payload, headers=headers)
        elapsed = time.time() - start

    return {"status": res.status_code, "elapsed": elapsed, "body": res.json()}


async def call_gateway() -> dict:
    """기존 Vercel 게이트웨이 호출 (비교용)"""
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": TEST_PROMPT}],
        "max_tokens": MAX_TOKENS,
        "temperature": 0.3,
    }
    headers = {
        "Authorization": f"Bearer {GATEWAY_SECRET}",
        "Content-Type": "application/json",
    }

    start = time.time()
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(GATEWAY_URL, json=payload, headers=headers)
        elapsed = time.time() - start

    return {"status": res.status_code, "elapsed": elapsed, "body": res.json()}


def extract_content(body: dict) -> str:
    try:
        return body["choices"][0]["message"]["content"]
    except Exception:
        return f"[파싱 실패] {body}"


def extract_usage(body: dict) -> str:
    usage = body.get("usage", {})
    if not usage:
        return "usage 없음"
    return (
        f"prompt={usage.get('prompt_tokens','?')} "
        f"completion={usage.get('completion_tokens','?')} "
        f"total={usage.get('total_tokens','?')}"
    )


async def main():
    print("=" * 60)
    print("OpenRouter 직접 호출 vs Vercel 게이트웨이 비교 테스트")
    print(f"모델: {MODEL}")
    print(f"프롬프트: {TEST_PROMPT}")
    print(f"max_tokens: {MAX_TOKENS}")
    print("=" * 60)

    # 1. 직접 호출 (첫 번째 키)
    print("\n[1] OpenRouter 직접 호출...")
    try:
        result = await call_direct(OPENROUTER_API_KEYS[0])
        print(f"  상태: {result['status']}")
        print(f"  응답 시간: {result['elapsed']:.2f}초")
        print(f"  토큰 사용: {extract_usage(result['body'])}")
        print(f"  응답 내용:\n    {extract_content(result['body'])[:200]}")
        finish = result["body"].get("choices", [{}])[0].get("finish_reason", "?")
        print(f"  finish_reason: {finish}")
    except Exception as e:
        print(f"  오류: {e}")

    print()

    # 2. 게이트웨이 호출 (비교)
    print("[2] Vercel 게이트웨이 호출 (비교용)...")
    try:
        result = await call_gateway()
        print(f"  상태: {result['status']}")
        print(f"  응답 시간: {result['elapsed']:.2f}초")
        print(f"  토큰 사용: {extract_usage(result['body'])}")
        print(f"  응답 내용:\n    {extract_content(result['body'])[:200]}")
        finish = result["body"].get("choices", [{}])[0].get("finish_reason", "?")
        print(f"  finish_reason: {finish}")
    except Exception as e:
        print(f"  오류: {e}")

    print("\n" + "=" * 60)
    print("테스트 완료")


if __name__ == "__main__":
    asyncio.run(main())
