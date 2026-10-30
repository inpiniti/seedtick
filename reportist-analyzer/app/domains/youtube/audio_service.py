"""Resolve and download a small audio segment from a YouTube video."""

import asyncio
import logging
import re
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qs, quote, urljoin, urlsplit

import httpx
import yt_dlp
from yt_dlp.utils import DownloadError

from app.config.settings import settings

logger = logging.getLogger("youtube_audio")

MAX_AUDIO_BYTES = 3_800_000
VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
COOKIE_NAME_PATTERN = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$")
YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "youtu.be",
}
STREAM_HOST_SUFFIXES = (".googlevideo.com", ".youtube.com")
RANGE_PATTERN = re.compile(r"bytes\s+\d+-\d+/(\d+|\*)", re.IGNORECASE)
URL_PATTERN = re.compile(r"https?://[^\s\"'<>]+", re.IGNORECASE)
SENSITIVE_HEADER_PATTERN = re.compile(
    r"(?i)\b(set-cookie|cookie|authorization)\s*[:=]\s*[^\r\n]+"
)
SENSITIVE_PARAM_PATTERN = re.compile(
    r"(?i)([\w-]*(?:token|sid|apisid|auth|cookie|signature|sig|key|visitor_data)[\w-]*)"
    r"\s*=\s*([^&;\s]+)"
)


class YouTubeAudioError(Exception):
    def __init__(self, code: str, message: str, status: int = 502, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.retryable = retryable


@dataclass(frozen=True)
class YouTubeAudioResult:
    video_id: str
    title: str
    duration_seconds: int
    itag: int
    mime_type: str
    extension: str
    data: bytes
    total_bytes: int
    truncated: bool
    audio_seconds: float
    filename: str


def _safe_error_detail(message: str) -> str:
    """Keep useful yt-dlp diagnostics while removing URLs and credential-like values."""
    sanitized = SENSITIVE_HEADER_PATTERN.sub(r"\1=<redacted>", message)
    sanitized = URL_PATTERN.sub("<url>", sanitized)
    sanitized = SENSITIVE_PARAM_PATTERN.sub(r"\1=<redacted>", sanitized)
    return " ".join(sanitized.split())[:240]


class _QuietYtDlpLogger:
    """Suppress extractor output, which can contain signed media URLs."""

    def debug(self, _message: str) -> None:
        pass

    def info(self, _message: str) -> None:
        pass

    def warning(self, _message: str) -> None:
        pass

    def error(self, _message: str) -> None:
        pass


def _extract_video_id(value: str) -> str | None:
    cleaned = value.strip()
    if VIDEO_ID_PATTERN.fullmatch(cleaned):
        return cleaned

    try:
        parsed = urlsplit(cleaned if "://" in cleaned else f"https://{cleaned}")
    except ValueError:
        return None

    host = (parsed.hostname or "").lower().rstrip(".")
    if host not in YOUTUBE_HOSTS:
        return None

    if host == "youtu.be":
        candidate = parsed.path.strip("/").split("/")[0]
        return candidate if VIDEO_ID_PATTERN.fullmatch(candidate) else None

    query_id = parse_qs(parsed.query).get("v", [""])[0]
    if VIDEO_ID_PATTERN.fullmatch(query_id):
        return query_id

    path_parts = [part for part in parsed.path.split("/") if part]
    if len(path_parts) >= 2 and path_parts[0] in {"shorts", "embed", "live", "v"}:
        candidate = path_parts[1]
        return candidate if VIDEO_ID_PATTERN.fullmatch(candidate) else None
    return None


def _cookie_file_content(raw_value: str) -> str | None:
    """Return a YouTube-only Netscape cookie file, accepting exported files or Cookie headers."""
    raw = raw_value.strip()
    if not raw or re.search(r"^\s*Set-Cookie\s*:", raw, flags=re.IGNORECASE | re.MULTILINE):
        return None
    raw = re.sub(r"^\s*Cookie\s*:\s*", "", raw, count=1, flags=re.IGNORECASE)

    lines = raw.splitlines()
    is_netscape = any("\t" in line for line in lines) or any(
        re.match(r"^#\s*(?:HTTP )?Cookie File", line, flags=re.IGNORECASE) for line in lines
    )
    if is_netscape:
        output = ["# Netscape HTTP Cookie File"]
        for line in lines:
            candidate = line.removeprefix("#HttpOnly_")
            if not candidate or candidate.startswith("#"):
                continue
            fields = candidate.split("\t")
            if len(fields) < 7:
                continue
            domain = fields[0].lower().lstrip(".")
            if domain != "youtube.com" and not domain.endswith(".youtube.com"):
                continue
            if not fields[5] or not fields[6]:
                continue
            output.append(line)
        return "\n".join(output) + "\n" if len(output) > 1 else None

    output = ["# Netscape HTTP Cookie File"]
    for item in raw.split(";"):
        separator = item.find("=")
        if separator <= 0:
            continue
        name = item[:separator].strip()
        value = item[separator + 1 :].strip()
        if not COOKIE_NAME_PATTERN.fullmatch(name) or not value or any(char in value for char in ";\r\n"):
            continue
        output.append(f".youtube.com\tTRUE\t/\tTRUE\t0\t{name}\t{value}")
    return "\n".join(output) + "\n" if len(output) > 1 else None


def _extract_info(video_id: str, cookie_file: str | None) -> dict:
    options: dict = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
        "cachedir": False,
        "socket_timeout": 20,
        "retries": 1,
        "extractor_retries": 1,
        "fragment_retries": 1,
        "js_runtimes": {"node": {}},
        "logger": _QuietYtDlpLogger(),
    }
    if cookie_file:
        options["cookiefile"] = cookie_file

    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
    except DownloadError as error:
        raw_reason = str(error)
        reason = raw_reason.lower()
        logger.warning(
            "[YT-DIAG-c91e] yt-dlp extraction error videoId=%s cookieAuth=%s detail=%s",
            video_id,
            bool(cookie_file),
            _safe_error_detail(raw_reason),
        )
        if any(
            term in reason
            for term in (
                "ssl:",
                "sslerror",
                "ssl error",
                "unexpected_eof_while_reading",
                "eof occurred in violation of protocol",
                "connection reset",
                "connection aborted",
                "timed out",
                "timeout",
            )
        ):
            raise YouTubeAudioError(
                "YOUTUBE_NETWORK_ERROR",
                "Analyzer 서버에서 YouTube 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.",
                502,
                True,
            ) from error
        if any(
            term in reason
            for term in (
                "confirm you're not a bot",
                "sign in to confirm",
                "not a bot",
                "login_required",
                "login required",
                "bot check",
            )
        ):
            code = "YOUTUBE_COOKIE_BOT_CHECK" if cookie_file else "YOUTUBE_BOT_CHECK"
            message = (
                "YouTube가 쿠키 인증 후에도 봇 확인을 요구했어요."
                if cookie_file
                else "YouTube가 Analyzer 서버 요청에 로그인을 요구했어요."
            )
            raise YouTubeAudioError(code, message, 422) from error
        if any(term in reason for term in ("video unavailable", "private video", "has been removed")):
            raise YouTubeAudioError(
                "YOUTUBE_VIDEO_UNAVAILABLE", "YouTube에서 이 영상을 재생할 수 없어요.", 422
            ) from error
        raise YouTubeAudioError(
            "YOUTUBE_PLAYER_FAILED", "Analyzer 서버에서 YouTube 오디오 정보를 가져오지 못했어요.", 502, True
        ) from error

    if not isinstance(info, dict):
        raise YouTubeAudioError(
            "YOUTUBE_PLAYER_INVALID_RESPONSE", "YouTube가 올바른 영상 정보를 반환하지 않았어요.", 502
        )
    return info


def _estimate_size(audio_format: dict, duration: float) -> int | None:
    for field in ("filesize", "filesize_approx"):
        value = audio_format.get(field)
        if isinstance(value, (int, float)) and value > 0:
            return int(value)
    bitrate = audio_format.get("abr") or audio_format.get("tbr")
    if isinstance(bitrate, (int, float)) and bitrate > 0 and duration > 0:
        return int(bitrate * 1000 * duration / 8)
    return None


def _format_rank(audio_format: dict) -> tuple[int, float]:
    format_id = str(audio_format.get("format_id", ""))
    preferred_ids = {"140": 0, "139": 1, "251": 2, "250": 3, "249": 4}
    if format_id in preferred_ids:
        return preferred_ids[format_id], -float(audio_format.get("abr") or 0)
    extension = str(audio_format.get("ext", "")).lower()
    extension_rank = 5 if extension in {"m4a", "mp4"} else 6 if extension == "webm" else 7
    return extension_rank, -float(audio_format.get("abr") or 0)


def _select_audio_format(info: dict) -> tuple[dict, int | None] | None:
    duration = float(info.get("duration") or 0)
    formats = list(info.get("formats") or []) + list(info.get("requested_formats") or [])
    if info.get("url") and info.get("acodec") not in (None, "none"):
        formats.append(info)

    candidates: list[tuple[dict, int | None]] = []
    seen: set[str] = set()
    for audio_format in formats:
        if not isinstance(audio_format, dict):
            continue
        stream_url = audio_format.get("url")
        audio_codec = audio_format.get("acodec")
        video_codec = audio_format.get("vcodec")
        protocol = audio_format.get("protocol")
        if not isinstance(stream_url, str) or not stream_url:
            continue
        if audio_codec in (None, "none") or video_codec not in (None, "none"):
            continue
        if protocol not in (None, "http", "https"):
            continue
        if stream_url in seen:
            continue
        seen.add(stream_url)
        candidates.append((audio_format, _estimate_size(audio_format, duration)))

    if not candidates:
        return None

    ranked = sorted(candidates, key=lambda item: _format_rank(item[0]))
    fitting = next((item for item in ranked if item[1] and item[1] <= MAX_AUDIO_BYTES), None)
    if fitting:
        return fitting
    known_sizes = [item for item in candidates if item[1] and item[1] > 0]
    if known_sizes:
        return min(known_sizes, key=lambda item: item[1] or 0)
    return ranked[0]


def _validate_stream_url(stream_url: str) -> None:
    parsed = urlsplit(stream_url)
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or not any(
        host == suffix.removeprefix(".") or host.endswith(suffix) for suffix in STREAM_HOST_SUFFIXES
    ):
        raise YouTubeAudioError(
            "YOUTUBE_AUDIO_URL_INVALID", "YouTube가 안전하지 않은 오디오 주소를 반환했어요.", 502
        )


async def _download_audio(audio_format: dict, estimated_size: int | None) -> tuple[bytes, int, bool]:
    stream_url = str(audio_format["url"])
    _validate_stream_url(stream_url)
    headers = {
        "Range": f"bytes=0-{MAX_AUDIO_BYTES - 1}",
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://www.youtube.com",
        "Referer": "https://www.youtube.com/",
        "Accept-Encoding": "identity",
    }
    for name, value in (audio_format.get("http_headers") or {}).items():
        if name.lower() not in {
            "host",
            "content-length",
            "range",
            "connection",
            "cookie",
            "authorization",
        }:
            headers[name] = str(value)

    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
            current_url = stream_url
            response = None
            for _ in range(5):
                _validate_stream_url(current_url)
                response = await client.send(
                    client.build_request("GET", current_url, headers=headers), stream=True
                )
                if response.status_code not in {301, 302, 303, 307, 308}:
                    break
                location = response.headers.get("location")
                await response.aclose()
                if not location:
                    raise YouTubeAudioError(
                        "YOUTUBE_AUDIO_FETCH_FAILED", "YouTube 오디오 주소가 만료되었어요.", 502, True
                    )
                current_url = urljoin(current_url, location)

            if response is None:
                raise YouTubeAudioError(
                    "YOUTUBE_AUDIO_FETCH_FAILED", "YouTube 오디오 스트림을 열지 못했어요.", 502, True
                )
            async with response:
                if response.status_code < 200 or response.status_code >= 300:
                    raise YouTubeAudioError(
                        "YOUTUBE_AUDIO_FETCH_FAILED",
                        f"YouTube 오디오 스트림이 HTTP {response.status_code}로 응답했어요.",
                        502,
                        response.status_code in {403, 404, 410} or response.status_code >= 500,
                    )

                content_range = RANGE_PATTERN.search(response.headers.get("content-range", ""))
                declared_size = None
                if content_range and content_range.group(1) != "*":
                    declared_size = int(content_range.group(1))
                elif response.status_code == 200:
                    try:
                        declared_size = int(response.headers.get("content-length", ""))
                    except ValueError:
                        declared_size = None

                chunks: list[bytes] = []
                received = 0
                reached_limit = False
                async for chunk in response.aiter_bytes():
                    if not chunk:
                        continue
                    remaining = MAX_AUDIO_BYTES - received
                    if len(chunk) >= remaining:
                        chunks.append(chunk[:remaining])
                        received += remaining
                        reached_limit = True
                        break
                    chunks.append(chunk)
                    received += len(chunk)

                data = b"".join(chunks)
                if not data:
                    raise YouTubeAudioError(
                        "YOUTUBE_AUDIO_EMPTY", "YouTube 오디오 스트림이 비어 있어요.", 502, True
                    )
                total_bytes = declared_size or estimated_size or received
                if reached_limit and total_bytes <= received and not declared_size:
                    total_bytes = max(estimated_size or 0, received + 1)
                return data, total_bytes, total_bytes > received
    except YouTubeAudioError:
        raise
    except httpx.TimeoutException as error:
        raise YouTubeAudioError(
            "YOUTUBE_AUDIO_UNREACHABLE", "Analyzer 서버에서 YouTube 오디오를 받는 시간이 초과됐어요.", 502, True
        ) from error
    except httpx.HTTPError as error:
        raise YouTubeAudioError(
            "YOUTUBE_AUDIO_FETCH_FAILED", "Analyzer 서버에서 YouTube 오디오를 받지 못했어요.", 502, True
        ) from error


def _sanitize_filename(title: str, video_id: str, extension: str) -> str:
    cleaned = "".join(char for char in title if ord(char) >= 32)
    cleaned = re.sub(r'[\\/:*?"<>|]', " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()[:80]
    return f"{cleaned or f'youtube-{video_id}'}.{extension}"


def _encode_header(value: str) -> str:
    return quote(value, safe="~!*()'-._")


async def fetch_youtube_audio(input_value: str) -> YouTubeAudioResult:
    video_id = _extract_video_id(input_value)
    if not video_id:
        raise YouTubeAudioError(
            "INVALID_YOUTUBE_URL", "유튜브 주소나 11자리 영상 키를 정확히 입력해 주세요.", 400
        )

    request_started = time.monotonic()
    configured_cookie = settings.YOUTUBE_COOKIE.strip()
    cookie_content = _cookie_file_content(configured_cookie)
    if configured_cookie and not cookie_content:
        raise YouTubeAudioError(
            "YOUTUBE_COOKIE_INVALID",
            (
                "YOUTUBE_COOKIE에 로그인된 YouTube의 cookies.txt 전체 내용이나 Cookie 요청 헤더를 "
                "설정해 주세요. Set-Cookie 응답 헤더는 사용할 수 없어요."
            ),
            503,
        )
    with tempfile.TemporaryDirectory(prefix="reportist-youtube-") as temp_dir:
        cookie_file: str | None = None
        if cookie_content:
            cookie_path = Path(temp_dir) / "cookies.txt"
            cookie_path.write_text(cookie_content, encoding="utf-8", newline="\n")
            cookie_file = str(cookie_path)

        attempts = [None, cookie_file] if cookie_file else [None]
        info: dict | None = None
        last_error: YouTubeAudioError | None = None
        selected: tuple[dict, int | None] | None = None
        attempt_count = 0

        for attempt_index, current_cookie_file in enumerate(attempts):
            attempt_count += 1
            attempt_started = time.monotonic()
            try:
                candidate_info = await asyncio.to_thread(
                    _extract_info, video_id, current_cookie_file
                )
                candidate_format = _select_audio_format(candidate_info)
                if candidate_format:
                    info = candidate_info
                    selected = candidate_format
                    logger.info(
                        "[YT-DIAG-c91e] Extraction attempt succeeded videoId=%s cookieAuth=%s "
                        "elapsedSeconds=%.1f directAudioFormats=%s",
                        video_id,
                        bool(current_cookie_file),
                        time.monotonic() - attempt_started,
                        sum(
                            1
                            for item in candidate_info.get("formats", [])
                            if isinstance(item, dict)
                            and item.get("acodec") not in (None, "none")
                            and item.get("vcodec") in (None, "none")
                            and isinstance(item.get("url"), str)
                        ),
                    )
                    break
                logger.warning(
                    "[YT-DIAG-c91e] Extraction returned no direct audio videoId=%s cookieAuth=%s "
                    "elapsedSeconds=%.1f formatCount=%s",
                    video_id,
                    bool(current_cookie_file),
                    time.monotonic() - attempt_started,
                    len(candidate_info.get("formats") or []),
                )
                last_error = YouTubeAudioError(
                    "YOUTUBE_AUDIO_NOT_FOUND",
                    "YouTube가 직접 사용할 수 있는 오디오 스트림을 제공하지 않았어요.",
                    422,
                )
            except YouTubeAudioError as error:
                logger.warning(
                    "[YT-DIAG-c91e] Extraction attempt failed videoId=%s cookieAuth=%s "
                    "elapsedSeconds=%.1f code=%s",
                    video_id,
                    bool(current_cookie_file),
                    time.monotonic() - attempt_started,
                    error.code,
                )
                last_error = error
                if error.code == "YOUTUBE_VIDEO_UNAVAILABLE":
                    raise
                if error.code == "YOUTUBE_NETWORK_ERROR":
                    logger.info(
                        "[YT-DIAG-c91e] Skipping cookie fallback after transport failure "
                        "videoId=%s cookieAuth=%s",
                        video_id,
                        bool(current_cookie_file),
                    )
                    break

            if attempt_index == 0 and cookie_file:
                logger.info(
                    "[YT-DIAG-c91e] Retrying extraction with configured cookies for video %s "
                    "firstAttemptSeconds=%.1f",
                    video_id,
                    time.monotonic() - attempt_started,
                )
                continue
            break

        if not info or not selected:
            final_error = last_error or YouTubeAudioError(
                "YOUTUBE_AUDIO_NOT_FOUND",
                "이 영상에서 사용할 수 있는 오디오 스트림을 찾지 못했어요.",
                422,
            )
            logger.warning(
                "[YT-DIAG-c91e] Extraction exhausted attempts videoId=%s attempts=%s "
                "totalElapsedSeconds=%.1f code=%s",
                video_id,
                attempt_count,
                time.monotonic() - request_started,
                final_error.code,
            )
            raise final_error

        audio_format, estimated_size = selected
        duration = float(info.get("duration") or 0)
        if info.get("is_live"):
            raise YouTubeAudioError(
                "YOUTUBE_LIVE_STREAM", "실시간 라이브 영상에서는 배경음악을 가져올 수 없어요.", 422
            )

        mime_type = str(audio_format.get("mime_type") or "").split(";")[0].strip()
        extension_raw = str(audio_format.get("ext") or "").lower()
        if not mime_type:
            mime_type = "audio/webm" if extension_raw == "webm" else "audio/mp4"
        extension = "webm" if extension_raw == "webm" or "webm" in mime_type else "m4a"
        if not mime_type.startswith("audio/"):
            mime_type = "audio/webm" if extension == "webm" else "audio/mp4"

        logger.info(
            "[YouTube] Resolved audio format %s for video %s (%s direct audio formats)",
            audio_format.get("format_id", "unknown"),
            video_id,
            sum(
                1
                for item in info.get("formats", [])
                if isinstance(item, dict)
                and item.get("acodec") not in (None, "none")
                and item.get("vcodec") in (None, "none")
                and isinstance(item.get("url"), str)
            ),
        )

        data, total_bytes, truncated = await _download_audio(audio_format, estimated_size)
        logger.info(
            "[YT-DIAG-c91e] Audio download completed videoId=%s bytes=%s totalElapsedSeconds=%.1f",
            video_id,
            len(data),
            time.monotonic() - request_started,
        )
        duration_seconds = max(0, round(duration))
        audio_seconds = duration
        if truncated and total_bytes > 0 and duration > 0:
            audio_seconds = min(duration, duration * len(data) / total_bytes)
        audio_seconds = round(max(0.0, audio_seconds), 1)
        title = str(info.get("title") or f"YouTube 오디오 ({video_id})").strip()
        try:
            itag = int(str(audio_format.get("format_id", "0")))
        except ValueError:
            itag = 0

        return YouTubeAudioResult(
            video_id=video_id,
            title=title,
            duration_seconds=duration_seconds,
            itag=itag,
            mime_type=mime_type,
            extension=extension,
            data=data,
            total_bytes=total_bytes,
            truncated=truncated,
            audio_seconds=audio_seconds,
            filename=_sanitize_filename(title, video_id, extension),
        )


def youtube_audio_headers(audio: YouTubeAudioResult) -> dict[str, str]:
    encoded_filename = quote(audio.filename, safe="~!*()'-._")
    return {
        "content-type": audio.mime_type,
        "content-length": str(len(audio.data)),
        "cache-control": "no-store",
        "content-disposition": f"inline; filename*=UTF-8''{encoded_filename}",
        "x-youtube-video-id": audio.video_id,
        "x-youtube-title": _encode_header(audio.title),
        "x-youtube-filename": _encode_header(audio.filename),
        "x-youtube-duration": str(audio.duration_seconds),
        "x-youtube-itag": str(audio.itag),
        "x-youtube-total-bytes": str(audio.total_bytes),
        "x-youtube-audio-bytes": str(len(audio.data)),
        "x-youtube-audio-seconds": f"{audio.audio_seconds:.1f}",
        "x-youtube-truncated": "1" if audio.truncated else "0",
    }
