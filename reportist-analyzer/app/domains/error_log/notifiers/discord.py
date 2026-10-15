"""
Discord 알림 발송 모듈
"""
import logging
import httpx
from app.config.settings import settings

logger = logging.getLogger("discord_notifier")


class DiscordNotifier:
    def __init__(self, webhook_url: str | None = None):
        self.webhook_url = webhook_url or settings.DISCORD_WEBHOOK_URL

    async def send_message(self, content: str, embeds: list[dict] | None = None) -> bool:
        if not self.webhook_url:
            logger.debug(f"[Discord] Webhook URL 미설정 — 메시지 로그: {content[:100]}")
            return False

        payload = {"content": content}
        if embeds:
            payload["embeds"] = embeds

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(self.webhook_url, json=payload)
                return res.status_code in (200, 204)
        except Exception as e:
            logger.error(f"[Discord] 알림 전송 실패: {e}")
            return False

    async def notify_holiday_skip(self, reason: str, market: str = "all"):
        m_tag = {"us": " [미국장]", "kr": " [한국장]"}.get(str(market).lower(), "")
        msg = f"🛌 **[Reportist 스케줄러{m_tag}]** 오늘은 {reason}입니다. 파이프라인을 실행하지 않고 스킵합니다."
        await self.send_message(msg)

    async def notify_pipeline_summary(
        self,
        date_str: str,
        screened_count: int,
        reported_count: int,
        orders: list | None = None,
        market: str = "all",
    ):
        m_tag = {"us": " [미국장]", "kr": " [한국장]"}.get(str(market).lower(), "")

        msg = (
            f"🚀 **[Reportist 일일 파이프라인 완료{m_tag}]** ({date_str})\n"
            f"• 스크리닝 통과: **{screened_count}**개\n"
            f"• 13인 거장 리포트 생성: **{reported_count}**개"
        )
        await self.send_message(msg)

