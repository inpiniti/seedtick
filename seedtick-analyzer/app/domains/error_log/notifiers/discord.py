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

    async def notify_holiday_skip(self, reason: str):
        msg = f"🛌 **[SeedTick 스케줄러]** 오늘은 {reason}입니다. 일일 파이프라인을 실행하지 않고 스킵합니다."
        await self.send_message(msg)

    async def notify_pipeline_summary(
        self,
        date_str: str,
        screened_count: int,
        reported_count: int,
        orders: list,
    ):
        order_lines = []
        for o in orders:
            status = "✅ 체결" if o.success else "❌ 실패"
            order_lines.append(f"- {status} {o.ticker} {o.action} ({o.amount_krw:,}원)")

        order_text = "\n".join(order_lines) if order_lines else "- 발주 대상 종목 없음 (종합 매수 판정 없음)"

        msg = (
            f"🚀 **[SeedTick 일일 파이프라인 완료]** ({date_str})\n"
            f"• 스크리닝 통과: **{screened_count}**개\n"
            f"• 13인 거장 리포트 생성: **{reported_count}**개\n"
            f"• 자동매매 실행 내역:\n{order_text}"
        )
        await self.send_message(msg)
