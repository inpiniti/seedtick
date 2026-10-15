"""
관리자 전용 엔드포인트 인증 의존성.

파이프라인(trigger/progress/cleanup-logs) + AI 디버그(/debug/*)는 찐 어드민 기능이므로
Supabase JWT를 검증하고 user_profiles.is_admin 플래그를 확인한다.

- 토큰 없음/무효 → 401
- 관리자 아님 → 403
- Supabase 미설정 → 503 (fail-closed, 우회 불가)
"""
from __future__ import annotations

import logging

import httpx
from fastapi import Depends, Header, HTTPException, status
from supabase import create_client

from app.config.settings import settings

logger = logging.getLogger("admin_auth")


def _admin_auth_configured() -> bool:
    return bool(
        settings.SUPABASE_URL
        and settings.SUPABASE_ANON_KEY
        and settings.SUPABASE_SERVICE_ROLE_KEY
    )


async def get_current_user(
    authorization: str | None = Header(default=None),
) -> dict:
    """Bearer Supabase JWT를 검증하고 Supabase user 객체 반환."""
    if not _admin_auth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="관리자 인증 설정이 되어 있지 않습니다. (SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY)",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다. (Authorization Bearer 토큰 없음)",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
        )

    url = settings.SUPABASE_URL.rstrip("/") + "/auth/v1/user"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                url,
                headers={
                    "apikey": settings.SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}",
                },
            )
    except Exception as e:
        logger.warning(f"[admin_auth] Supabase Auth 호출 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="인증 서버 확인 중 오류가 발생했습니다.",
        )

    if res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 만료되었거나 유효하지 않습니다.",
        )
    try:
        user = res.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증 응답을 확인할 수 없습니다.",
        )
    if not user or not user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유저 인증 실패",
        )
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """is_admin 플래그 확인. 일반 계정은 403."""
    try:
        client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
        )
        row = (
            client.table("user_profiles")
            .select("is_admin")
            .eq("id", user["id"])
            .maybe_single()
            .execute()
        )
    except Exception as e:
        logger.warning(f"[admin_auth] is_admin 조회 실패: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="관리자 확인 중 오류가 발생했습니다.",
        )

    data = getattr(row, "data", None)
    if isinstance(data, list):
        data = data[0] if data else None
    if not isinstance(data, dict) or data.get("is_admin") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다.",
        )
    return user
