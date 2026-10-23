"""
소셜 미디어(X/Twitter) 자동 발행 도메인 서비스
"""
import json
import logging
import os
import random
import re
from datetime import datetime, timezone
from typing import Any

from app.config.settings import settings
from app.domains.social.twitter_client import TwitterClient
from app.domains.social.tweet_formatter import format_stock_tweet
from app.infrastructure.supabase_repo import SupabaseRepo

logger = logging.getLogger("social_service")

RECENT_TWEETS_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", ".recently_tweeted.json"
)


class SocialService:
    def __init__(self, twitter_client: TwitterClient | None = None):
        self.twitter_client = twitter_client or TwitterClient()
        self.supabase_repo = SupabaseRepo()

    def _load_recently_tweeted(self) -> list[str]:
        """최근 트윗 발행된 티커 목록 로드"""
        try:
            if os.path.exists(RECENT_TWEETS_FILE):
                with open(RECENT_TWEETS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("recent_tickers", [])
        except Exception as e:
            logger.warning(f"[SocialService] 최근 트윗 기록 로드 실패: {e}")
        return []

    def _save_recently_tweeted(self, ticker: str, tweet_id: str | None = None):
        """최근 트윗 발행된 티커 기록 (최대 30개 보관)"""
        try:
            recent = self._load_recently_tweeted()
            if ticker in recent:
                recent.remove(ticker)
            recent.insert(0, ticker)
            recent = recent[:30]

            with open(RECENT_TWEETS_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "recent_tickers": recent,
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
        except Exception as e:
            logger.warning(f"[SocialService] 최근 트윗 기록 저장 실패: {e}")

    async def get_candidate_report(self, specific_ticker: str | None = None) -> dict[str, Any] | None:
        """
        Supabase에서 트윗할 대상 리포트 조회
        1. specific_ticker가 지정되면 해당 종목 최신 리포트 조회
        2. 미지정 시 최근 분석된 미국 주식(영문 1~5자) 중 최근 트윗되지 않은 종목 랜덤 선택
        """
        client = self.supabase_repo._client
        if not client:
            logger.error("[SocialService] Supabase 클라이언트가 초기화되지 않았습니다.")
            return None

        # 특정 티커 직접 지정 시
        if specific_ticker:
            norm_ticker = specific_ticker.strip().upper()
            res = (
                client.from_("guru_reports")
                .select("*")
                .eq("ticker", norm_ticker)
                .order("d", desc=True)
                .limit(1)
                .execute()
            )
            rows = res.data or []
            return rows[0] if rows else None

        # 최근 100건 조회하여 적격 후보 필터링
        res = (
            client.from_("guru_reports")
            .select(
                "id, ticker, d, company_name, company_name_en, verdict, overall_score, "
                "votes_buy, votes_watch, votes_hold, votes_sell, fair_value, "
                "current_price, upside_pct, summaries"
            )
            .order("d", desc=True)
            .order("overall_score", desc=False)
            .limit(100)
            .execute()
        )
        rows = res.data or []
        if not rows:
            logger.warning("[SocialService] 조회된 guru_reports 가 없습니다.")
            return None

        # 유효한 미국 주식 티커 심볼(영문 1~5자)만 선별 (FinTwit 타겟)
        us_ticker_pattern = re.compile(r"^[A-Z]{1,5}$")
        valid_rows = [r for r in rows if r.get("ticker") and us_ticker_pattern.match(r["ticker"])]

        if not valid_rows:
            # 미국 주식이 없으면 전체 유효 티커로 폴백
            valid_rows = [r for r in rows if r.get("ticker") and re.match(r"^[A-Z0-9.]{1,10}$", r["ticker"])]

        if not valid_rows:
            return None

        recent_tickers = set(self._load_recently_tweeted())
        # 최근 트윗되지 않은 후보군
        unseen_candidates = [r for r in valid_rows if r["ticker"] not in recent_tickers]

        if unseen_candidates:
            selected = random.choice(unseen_candidates)
        else:
            # 모든 종목이 최근 트윗되었으면 전체 후보군 중에서 랜덤 선택
            selected = random.choice(valid_rows)

        return selected

    async def publish_stock_tweet(
        self,
        ticker: str | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """
        종목을 선정하여 고품질 트윗 생성 및 X(Twitter)로 발행
        """
        report = await self.get_candidate_report(specific_ticker=ticker)
        if not report:
            err_msg = f"트윗할 대상 리포트를 찾지 못했습니다. (ticker={ticker})"
            logger.warning(f"[SocialService] {err_msg}")
            return {"success": False, "error": err_msg}

        selected_ticker = report.get("ticker", "").upper()
        tweet_text = format_stock_tweet(report)

        logger.info(
            f"[SocialService] 트윗 생성 완료 (ticker={selected_ticker}, dry_run={dry_run}):\n{tweet_text}"
        )

        if dry_run:
            return {
                "success": True,
                "dry_run": True,
                "ticker": selected_ticker,
                "text": tweet_text,
                "url": f"https://www.reportist.kr/en/stocks/{selected_ticker}",
            }

        if not self.twitter_client.is_configured():
            err_msg = "Twitter API 연동 키가 설정되지 않았습니다."
            logger.error(f"[SocialService] {err_msg}")
            return {"success": False, "error": err_msg, "text": tweet_text}

        # X API로 실제 트윗 전송
        try:
            result = await self.twitter_client.post_tweet(tweet_text)
            tweet_id = result.get("id")
            self._save_recently_tweeted(selected_ticker, tweet_id)
            return {
                "success": True,
                "dry_run": False,
                "ticker": selected_ticker,
                "tweet_id": tweet_id,
                "tweet_url": result.get("url"),
                "text": tweet_text,
            }
        except Exception as e:
            logger.error(f"[SocialService] 트윗 발행 실패: {e}")
            return {
                "success": False,
                "ticker": selected_ticker,
                "error": str(e),
                "text": tweet_text,
            }
