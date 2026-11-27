"""OpenCode 브릿지 라우트 테스트."""
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.routes import opencode as opencode_route
from app.main import app


@pytest.fixture
def gateway_secret(monkeypatch):
    monkeypatch.setattr(opencode_route.settings, "AI_GATEWAY_SECRET", "test-secret")
    return "test-secret"


@pytest.mark.asyncio
async def test_bridge_requires_bearer():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/opencode/v1/chat/completions",
            json={"model": "opencode/hy4-flash-free", "messages": [{"role": "user", "content": "hi"}]},
        )
    assert res.status_code in (401, 503)  # secret 미설정 시 503, 설정 시 401


@pytest.mark.asyncio
async def test_bridge_rejects_wrong_secret(gateway_secret):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/opencode/v1/chat/completions",
            headers={"Authorization": "Bearer wrong", "X-OpenCode-Api-Key": "oc_sk_test"},
            json={"model": "opencode/hy4-flash-free", "messages": [{"role": "user", "content": "hi"}]},
        )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_bridge_requires_key_header(gateway_secret):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/opencode/v1/chat/completions",
            headers={"Authorization": f"Bearer {gateway_secret}"},
            json={"model": "opencode/hy4-flash-free", "messages": [{"role": "user", "content": "hi"}]},
        )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_bridge_non_stream_passthrough(gateway_secret, monkeypatch):
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {
        "id": "chatcmpl-1",
        "object": "chat.completion",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": "PONG"}, "finish_reason": "stop"}],
    }
    client = MagicMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    client.post = AsyncMock(return_value=fake_response)
    monkeypatch.setattr(opencode_route.httpx, "AsyncClient", lambda **_: client)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/opencode/v1/chat/completions",
            headers={"Authorization": f"Bearer {gateway_secret}", "X-OpenCode-Api-Key": "oc_sk_test"},
            json={"model": "opencode/hy4-flash-free", "messages": [{"role": "user", "content": "hi"}]},
        )
    assert res.status_code == 200
    assert res.json()["choices"][0]["message"]["content"] == "PONG"
    assert client.post.call_args.kwargs["headers"]["X-OpenCode-Api-Key"] == "oc_sk_test"


def test_sidecar_dir_resolution():
    from app.domains.opencode.sidecar import OpenCodeSidecarManager

    shim = OpenCodeSidecarManager._find_shim_dir()
    assert shim is not None
    assert (shim / "src" / "server.ts").exists()


@pytest.mark.asyncio
async def test_bridge_public_key_passthrough(gateway_secret, monkeypatch):
    fake_response = MagicMock()
    fake_response.status_code = 200
    fake_response.json.return_value = {
        "id": "chatcmpl-public",
        "object": "chat.completion",
        "choices": [{"index": 0, "message": {"role": "assistant", "content": "OK"}, "finish_reason": "stop"}],
    }
    client = MagicMock()
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    client.post = AsyncMock(return_value=fake_response)
    monkeypatch.setattr(opencode_route.httpx, "AsyncClient", lambda **_: client)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/opencode/v1/chat/completions",
            headers={"Authorization": f"Bearer {gateway_secret}", "X-OpenCode-Api-Key": "public"},
            json={"model": "opencode/hy4-flash-free", "messages": [{"role": "user", "content": "hi"}]},
        )
    assert res.status_code == 200
    assert client.post.call_args.kwargs["headers"]["X-OpenCode-Api-Key"] == "public"


@pytest.mark.asyncio
async def test_bridge_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/opencode/health")
    assert res.status_code == 200
    assert "running" in res.json()
