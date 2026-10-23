"""
Curator CLI Entrypoint
수동 실행 및 테스트를 위한 CLI 스크립트
사용법:
  python -m app.domains.curator.main --dry-run
  python -m app.domains.curator.main --date 2026-10-23
"""
import argparse
import asyncio
import logging
import sys

from app.domains.curator.service import DailyCuratorService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


async def async_main():
    parser = argparse.ArgumentParser(description="Daily Community & News AI Curator")
    parser.add_argument("--dry-run", action="store_true", help="수집 및 필터링만 수행하고 AI 생성 및 파일 저장 생략")
    parser.add_argument("--date", type=str, default=None, help="대상 일자 (YYYY-MM-DD), 기본값: 오늘")
    args = parser.parse_args()

    service = DailyCuratorService()
    result = await service.run_daily_curator(
        target_date=args.date,
        dry_run=args.dry_run,
    )
    print("\n================ [실행 결과] ================")
    for k, v in result.items():
        print(f"{k}: {v}")
    print("=============================================\n")


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
