"""
Backfill script for market_briefings table:
Translates existing Korean daily briefings into English (title_en, content_en, summary_3lines_en, topics_en, keywords_en)
using BriefingWriter.translate_briefing_to_en.
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.domains.curator.writer import BriefingWriter
from app.infrastructure.supabase_repo import supabase_repo

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_briefing_en")


async def backfill_all_briefings(target_date: str | None = None, force: bool = False):
    if not supabase_repo.is_connected():
        logger.error("Supabase client is not connected. Check environment variables.")
        return

    client = supabase_repo._client
    query = client.table("market_briefings").select("*").order("d", desc=True)
    if target_date:
        query = query.eq("d", target_date)

    res = query.execute()
    rows = res.data or []
    logger.info(f"총 {len(rows)}건의 market_briefings 행을 확인합니다.")

    writer = BriefingWriter()
    updated_count = 0

    for row in rows:
        d_val = row.get("d")
        existing_en = row.get("content_en")
        if existing_en and not force:
            logger.info(f"[{d_val}] 이미 영문 콘텐츠(content_en)가 존재하여 건너뜁니다.")
            continue

        korean_title = row.get("title") or f"[데일리 마켓 브리핑] {d_val}"
        korean_content = row.get("content") or ""
        summary_3lines = row.get("summary_3lines") or []
        topics = row.get("topics") or []
        tickers = row.get("tickers") or []

        if not korean_content:
            logger.warning(f"[{d_val}] 본문(content)이 없어 건너뜁니다.")
            continue

        logger.info(f"[{d_val}] 영문 번역 시작...")
        try:
            en_data = await writer.translate_briefing_to_en(
                date_str=str(d_val),
                korean_title=korean_title,
                korean_content=korean_content,
                summary_3lines=summary_3lines,
                topics=topics,
                tickers=tickers,
            )

            update_payload = {
                "title_en": en_data.get("title_en") or None,
                "content_en": en_data.get("content_en") or None,
                "summary_3lines_en": en_data.get("summary_3lines_en") or [],
                "topics_en": en_data.get("topics_en") or [],
                "keywords_en": en_data.get("keywords_en") or [],
            }

            client.table("market_briefings").update(update_payload).eq("id", row["id"]).execute()
            logger.info(f"[{d_val}] ✨ 영문 필드 업데이트 완료! (title_en: {en_data.get('title_en')})")
            updated_count += 1
        except Exception as err:
            logger.error(f"[{d_val}] 영문 번역 또는 업데이트 실패: {err}")

    logger.info(f"🎉 영문 브리핑 백필 완료: 총 {updated_count}건 업데이트됨.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Backfill English fields for market_briefings")
    parser.add_argument("--date", type=str, default=None, help="Specific date to backfill (YYYY-MM-DD)")
    parser.add_argument("--force", action="store_true", help="Force re-translation even if content_en exists")
    args = parser.parse_args()

    asyncio.run(backfill_all_briefings(target_date=args.date, force=args.force))
