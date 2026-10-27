"""
Daily Curator Orchestrator Service
전체 수집기 실행 -> 1차 필터 및 중복 배제 -> AI 브리핑 작성 -> 파일 및 히스토리 저장을 총괄하는 서비스
"""
from __future__ import annotations

import asyncio
from datetime import date as dt_date, datetime
import logging
from pathlib import Path
from typing import Sequence

from app.domains.curator.collectors.base import BaseCollector
from app.domains.curator.collectors.reddit_collector import RedditCollector
from app.domains.curator.collectors.news_collector import NewsCollector
from app.domains.curator.collectors.stocktwits_collector import StocktwitsCollector
from app.domains.curator.collectors.kr_community_collector import KRCommunityCollector
from app.domains.curator.dedup_engine import DeduplicationEngine
from app.domains.curator.models import CommunityPost, DailyBriefing
from app.domains.curator.writer import BriefingWriter
from app.domains.error_log.notifiers.discord import DiscordNotifier

logger = logging.getLogger("curator_service")

WORKSPACE_POST_DIR = Path(__file__).resolve().parents[4] / "post"


class DailyCuratorService:
    def __init__(
        self,
        collectors: list[BaseCollector] | None = None,
        dedup_engine: DeduplicationEngine | None = None,
        writer: BriefingWriter | None = None,
        output_dir: Path | str | None = None,
        save_to_file: bool = False,
    ):
        self.collectors = collectors or [
            RedditCollector(),
            NewsCollector(),
            StocktwitsCollector(),
            KRCommunityCollector(),
        ]
        self.dedup_engine = dedup_engine or DeduplicationEngine()
        self.writer = writer or BriefingWriter()
        self.output_dir = Path(output_dir or WORKSPACE_POST_DIR)
        self.save_to_file = save_to_file
        self.discord = DiscordNotifier()

    async def collect_all(self) -> list[CommunityPost]:
        """모든 등록된 수집기에서 병렬로 원천 데이터 수집"""
        logger.info(f"[CuratorService] 총 {len(self.collectors)}개 수집기 동시 실행 시작")
        tasks = [collector.collect() for collector in self.collectors]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_posts: list[CommunityPost] = []
        for c, res in zip(self.collectors, results):
            if isinstance(res, list):
                logger.info(f"[CuratorService] {c.name} 수집 완료: {len(res)}건")
                all_posts.extend(res)
            elif isinstance(res, Exception):
                logger.warning(f"[CuratorService] {c.name} 수집 실패: {res}")

        logger.info(f"[CuratorService] 전체 원천 데이터 수집 완료: 총 {len(all_posts)}건")
        return all_posts

    async def run_daily_curator(
        self,
        target_date: str | None = None,
        dry_run: bool = False,
    ) -> dict:
        """
        일일 큐레이터 배치 메인 실행 메소드
        """
        date_str = target_date or dt_date.today().isoformat()
        logger.info(f"🚀 [CuratorService] 데일리 큐레이터 파이프라인 시작 (일자: {date_str}, dry_run={dry_run})")

        # 1. 멀티채널 원천 데이터 수집
        raw_posts = await self.collect_all()
        if not raw_posts:
            logger.warning("[CuratorService] 수집된 데이터가 없습니다. 파이프라인 중단.")
            return {"status": "skipped", "reason": "no_data_collected", "date": date_str}

        # 2. 중복 방지 및 1차 필터링
        filtered_posts = self.dedup_engine.filter_candidates(raw_posts)
        if not filtered_posts:
            logger.warning("[CuratorService] 모든 데이터가 과거 주제와 중복되어 필터링되었습니다.")
            filtered_posts = raw_posts[:10]  # 최소 10건 유지 폴백

        # 과거 주제 문맥 생성
        history_context = self.dedup_engine.format_history_context_for_prompt()

        if dry_run:
            logger.info(f"[CuratorService] [DRY RUN] 필터링 통과 {len(filtered_posts)}건 확인됨. AI 생성 생략.")
            return {
                "status": "dry_run_success",
                "date": date_str,
                "raw_count": len(raw_posts),
                "filtered_count": len(filtered_posts),
                "sample_titles": [p.title for p in filtered_posts[:5]],
            }

        # 3. AI 저널리스트 브리핑 생성 (한국어)
        daily_briefing, history_item = await self.writer.generate_briefing(
            date_str=date_str,
            posts=filtered_posts,
            history_context=history_context,
        )

        # 3-1. 영문화 (i18n) 번역 및 메타데이터 생성
        try:
            en_data = await self.writer.translate_briefing_to_en(
                date_str=date_str,
                korean_title=daily_briefing.title,
                korean_content=daily_briefing.raw_content,
                summary_3lines=daily_briefing.summary_3lines,
                topics=history_item.keywords,
                tickers=history_item.tickers,
            )
            daily_briefing.title_en = en_data.get("title_en", "")
            daily_briefing.raw_content_en = en_data.get("content_en", "")
            daily_briefing.summary_3lines_en = en_data.get("summary_3lines_en", [])
            daily_briefing.topics_en = en_data.get("topics_en", [])
            daily_briefing.keywords_en = en_data.get("keywords_en", [])
        except Exception as en_err:
            logger.warning(f"[CuratorService] 영문 브리핑 생성 건너뜀 (오류): {en_err}")

        # 4. Supabase DB 적재 (public.market_briefings 테이블)
        from app.infrastructure.supabase_repo import supabase_repo

        briefing_row = {
            "id": date_str,
            "d": date_str,
            "title": daily_briefing.title,
            "content": daily_briefing.raw_content,
            "summary_3lines": daily_briefing.summary_3lines or [],
            "topics": history_item.keywords,
            "tickers": history_item.tickers,
            "keywords": history_item.keywords,
            "title_en": daily_briefing.title_en or None,
            "content_en": daily_briefing.raw_content_en or None,
            "summary_3lines_en": daily_briefing.summary_3lines_en or [],
            "topics_en": daily_briefing.topics_en or [],
            "keywords_en": daily_briefing.keywords_en or [],
            "sources": {
                p.platform.value: sum(1 for x in raw_posts if x.platform == p.platform)
                for p in raw_posts
            },
            "raw_count": len(raw_posts),
        }

        db_saved = supabase_repo.save_market_briefing(briefing_row)
        if db_saved:
            logger.info(f"[CuratorService] ✨ Supabase market_briefings 적재 완료 (id={date_str})")
        else:
            logger.warning("[CuratorService] Supabase market_briefings 저장 건너뜀 (연결 미설정 또는 테이블 미생성)")

        # 4-1. 파일 저장이 활성화된 경우에만 로컬 파일 생성
        if self.save_to_file:
            output_file = self.output_dir / f"{date_str}_market_briefing.txt"
            output_file_en = self.output_dir / f"{date_str}_market_briefing_en.txt"
            try:
                self.output_dir.mkdir(parents=True, exist_ok=True)
                output_file.write_text(daily_briefing.raw_content, encoding="utf-8")
                if daily_briefing.raw_content_en:
                    output_file_en.write_text(daily_briefing.raw_content_en, encoding="utf-8")
                logger.info(f"[CuratorService] 📄 브리핑 파일 저장 완료: {output_file}")
            except Exception as e:
                logger.error(f"[CuratorService] 파일 저장 실패 ({output_file}): {e}")

        # 5. 히스토리 DB 업데이트 (다음날 중복 방지용)
        self.dedup_engine.save_history_item(history_item)

        # 6. 디스코드 알림 (설정되어 있는 경우)
        try:
            await self.discord.notify_info(
                title=f"📰 [{date_str}] 데일리 커뮤니티 & 마켓 레이더 발행 완료",
                description=f"{daily_briefing.title}\n적재 상태: {'Supabase 저장 완료' if db_saved else '완료'}",
            )
        except Exception:
            pass

        return {
            "status": "success",
            "date": date_str,
            "title": daily_briefing.title,
            "db_saved": db_saved,
            "topics": history_item.keywords,
            "tickers": history_item.tickers,
            "summary_3lines": daily_briefing.summary_3lines,
        }

