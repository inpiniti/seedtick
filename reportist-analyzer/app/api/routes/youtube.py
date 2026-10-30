"""Authenticated internal route for YouTube audio extraction."""

import asyncio
import hmac
import logging

from fastapi import APIRouter, Header, Query
from fastapi.responses import JSONResponse, Response

from app.config.settings import settings
from app.domains.youtube.audio_service import (
    YouTubeAudioError,
    fetch_youtube_audio,
    youtube_audio_headers,
)

logger = logging.getLogger("youtube_route")
router = APIRouter(prefix="/internal/youtube", tags=["YouTube worker"])
_audio_semaphore = asyncio.Semaphore(2)


@router.get("/audio", summary="YouTube 오디오 추출 (내부 작업자)")
async def get_youtube_audio(
    url: str | None = Query(None, description="YouTube URL 또는 11자리 영상 키"),
    id: str | None = Query(None, description="11자리 YouTube videoId"),
    authorization: str | None = Header(None),
):
    configured_secret = settings.YOUTUBE_WORKER_SECRET
    if not configured_secret:
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "YOUTUBE_WORKER_NOT_CONFIGURED",
                    "message": "Analyzer의 YOUTUBE_WORKER_SECRET이 설정되지 않았어요.",
                    "type": "youtube_error",
                }
            },
        )

    expected = f"Bearer {configured_secret}"
    if not authorization or not hmac.compare_digest(authorization, expected):
        return JSONResponse(
            status_code=401,
            content={
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "YouTube 작업자 인증에 실패했어요.",
                    "type": "auth_error",
                }
            },
        )

    source = (url or id or "").strip()
    if not source:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "YOUTUBE_URL_REQUIRED",
                    "message": "url 또는 id 쿼리 파라미터가 필요해요.",
                    "type": "youtube_error",
                }
            },
        )

    try:
        async with _audio_semaphore:
            audio = await fetch_youtube_audio(source)
        return Response(content=audio.data, status_code=200, headers=youtube_audio_headers(audio))
    except YouTubeAudioError as error:
        logger.warning("YouTube audio extraction failed (%s)", error.code)
        return JSONResponse(
            status_code=error.status,
            content={
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "type": "youtube_error",
                }
            },
        )
    except Exception as error:
        logger.error("YouTube audio extraction failed (%s)", type(error).__name__)
        return JSONResponse(
            status_code=502,
            content={
                "error": {
                    "code": "YOUTUBE_AUDIO_FAILED",
                    "message": "Analyzer 서버에서 YouTube 오디오를 가져오지 못했어요.",
                    "type": "youtube_error",
                }
            },
        )
