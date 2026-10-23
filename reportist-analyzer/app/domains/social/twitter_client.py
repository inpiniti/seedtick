"""
Twitter (X) API v2 클라이언트
OAuth 1.0a HMAC-SHA1 서명을 사용하여 트윗을 게시합니다.
"""
import base64
import hashlib
import hmac
import logging
import secrets
import time
import urllib.parse
from typing import Any
import httpx

from app.config.settings import settings

logger = logging.getLogger("twitter_client")


class TwitterClient:
    def __init__(
        self,
        api_key: str | None = None,
        api_secret: str | None = None,
        access_token: str | None = None,
        access_token_secret: str | None = None,
    ):
        self.api_key = api_key or settings.TWITTER_API_KEY
        self.api_secret = api_secret or settings.TWITTER_API_SECRET
        self.access_token = access_token or settings.TWITTER_ACCESS_TOKEN
        self.access_token_secret = access_token_secret or settings.TWITTER_ACCESS_TOKEN_SECRET
        self.base_url = "https://api.twitter.com/2"

    def is_configured(self) -> bool:
        """API 연동 키가 모두 제공되었는지 확인"""
        return bool(
            self.api_key
            and self.api_secret
            and self.access_token
            and self.access_token_secret
        )

    def _generate_oauth_header(self, method: str, url: str) -> str:
        """RFC 5849 표준 OAuth 1.0a Authorization 헤더 생성"""
        oauth_params = {
            "oauth_consumer_key": self.api_key,
            "oauth_nonce": secrets.token_hex(16),
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp": str(int(time.time())),
            "oauth_token": self.access_token,
            "oauth_version": "1.0",
        }

        parsed = urllib.parse.urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        query_params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        all_params = list(oauth_params.items()) + query_params

        # 파라미터 정렬 및 인코딩
        encoded = [
            (urllib.parse.quote(k, safe=""), urllib.parse.quote(v, safe=""))
            for k, v in all_params
        ]
        encoded.sort(key=lambda x: (x[0], x[1]))
        normalized_str = "&".join(f"{k}={v}" for k, v in encoded)

        base_string = "&".join([
            method.upper(),
            urllib.parse.quote(base_url, safe=""),
            urllib.parse.quote(normalized_str, safe=""),
        ])

        signing_key = (
            f"{urllib.parse.quote(self.api_secret, safe='')}&"
            f"{urllib.parse.quote(self.access_token_secret, safe='')}"
        )

        hashed = hmac.new(
            signing_key.encode("utf-8"),
            base_string.encode("utf-8"),
            hashlib.sha1,
        )
        oauth_params["oauth_signature"] = base64.b64encode(hashed.digest()).decode("utf-8")

        parts = [
            f'{urllib.parse.quote(k, safe="")}="{urllib.parse.quote(v, safe="")}"'
            for k, v in sorted(oauth_params.items())
        ]
        return "OAuth " + ", ".join(parts)

    async def post_tweet(self, text: str) -> dict[str, Any]:
        """
        X API v2 POST /2/tweets 엔드포인트를 호출하여 트윗 발행
        """
        if not self.is_configured():
            raise ValueError("Twitter API 키가 .env에 설정되지 않았습니다.")

        url = f"{self.base_url}/tweets"
        auth_header = self._generate_oauth_header("POST", url)
        headers = {
            "Authorization": auth_header,
            "Content-Type": "application/json",
        }
        payload = {"text": text}

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers=headers, json=payload)

            if res.status_code in (200, 201):
                data = res.json()
                tweet_data = data.get("data", {})
                tweet_id = tweet_data.get("id")
                logger.info(f"[TwitterClient] 트윗 발행 성공! ID: {tweet_id}")
                return {
                    "success": True,
                    "id": tweet_id,
                    "text": tweet_data.get("text", text),
                    "url": f"https://x.com/reportist_app/status/{tweet_id}" if tweet_id else "",
                }
            else:
                logger.error(
                    f"[TwitterClient] 트윗 발행 실패 ({res.status_code}): {res.text}"
                )
                raise RuntimeError(
                    f"Twitter API Error ({res.status_code}): {res.text}"
                )
