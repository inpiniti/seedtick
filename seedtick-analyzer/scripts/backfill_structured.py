"""
과거 보고서 데이터 구조화 백필(Backfill) 스크립트

목적:
기존에 저장된 guru_reports 테이블의 jsonb(datapack, summaries) 및 마크다운(final_report)으로부터
1) guru_reports 신규 확장 정규 컬럼들 (fair_value, upside_pct, votes_buy/hold/watch/sell, avg_confidence, bull_points, bear_points 등)
2) guru_opinions 테이블 (13인 거장 개별 평가 롱 포맷 13행)
3) report_metrics 테이블 (데이터팩 재무/지표 숫자 컬럼)
을 자동으로 파싱/계산하여 일괄 채워넣습니다.

실행 방법:
  cd seedtick-analyzer
  python scripts/backfill_structured.py [--date 2026-10-07] [--limit 100] [--dry-run]
"""
import argparse
import asyncio
import logging
import sys
from pathlib import Path

# 프로젝트 루트 경로 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config.settings import settings
from app.infrastructure.supabase_repo import supabase_repo
from app.domains.report.structuring import (
    build_report_columns,
    build_opinion_rows,
    build_metrics_row,
    extract_master_sections,
    parse_price_range,
    parse_number,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_structured")


async def run_backfill(target_date: str | None = None, limit: int = 500, dry_run: bool = False):
    client = supabase_repo._client
    if not client:
        logger.error("Supabase 클라이언트가 설정되지 않았습니다. .env.local을 확인하세요.")
        return

    query = client.table("guru_reports").select(
        "id, d, ticker, company_name, current_price, verdict, overall_score, vote_summary, datapack, summaries, final_report"
    )
    if target_date:
        query = query.eq("d", target_date)
    query = query.order("d", desc=True).limit(limit)

    res = query.execute()
    rows = res.data or []
    logger.info(f"조회된 기존 보고서 레코드: 총 {len(rows)}건 (기준일 필터: {target_date or '전체'})")

    success_reports = 0
    total_opinions = 0
    total_metrics = 0

    for idx, r in enumerate(rows, start=1):
        report_id = r["id"]
        ticker = r["ticker"]
        d = r["d"]
        current_price = r.get("current_price") or 0.0
        datapack = r.get("datapack") or {}
        summaries = r.get("summaries") or []
        final_md = r.get("final_report") or ""

        # 1. 마크다운에서 밸류에이션 및 섹션 정보 추출
        val_consensus = datapack.get("valuation_consensus") or {}
        fv = parse_number(val_consensus.get("fair_value_price"))
        t_band = val_consensus.get("target_price_band")
        s_price = val_consensus.get("safety_entry_price")
        o_price = val_consensus.get("optimistic_target_price")

        b_low, b_high = parse_price_range(t_band)
        _, s_val = parse_price_range(s_price)
        if s_val is None:
            s_val = parse_number(s_price)
        t_val = parse_number(o_price)

        sec_data = extract_master_sections(final_md)

        # 2. guru_reports 확장 컬럼 계산
        extra_cols = build_report_columns(
            current_price=current_price,
            summaries=summaries,
            fair_value=fv,
            target_price_band=t_band,
            safety_entry_price=s_price,
            optimistic_target_price=o_price,
            band_low=b_low,
            band_high=b_high,
            safety_entry_value=s_val,
            target_sell_value=t_val,
            conclusion=sec_data["conclusion"],
            hot_topics=sec_data["hot_topics"],
            bull_points=sec_data["bull_points"],
            bear_points=sec_data["bear_points"],
            key_drivers=sec_data["key_drivers"],
            parse_mode="legacy_backfill",
            prompt_version="legacy",
        )

        # 3. guru_opinions 행 생성
        opinion_rows = build_opinion_rows(
            report_id=report_id,
            date_str=d,
            ticker=ticker,
            current_price=current_price,
            summaries=summaries,
            prompt_version="legacy",
        )

        # 4. report_metrics 행 생성
        metrics_row = build_metrics_row(
            report_id=report_id,
            date_str=d,
            ticker=ticker,
            datapack=datapack,
        )

        if dry_run:
            logger.info(
                f"[DRY-RUN] ({idx}/{len(rows)}) {report_id}: "
                f"의견={r.get('verdict')}, 적정가={fv}, 의견수={len(opinion_rows)}, PER={metrics_row.get('per')}"
            )
            continue

        # DB 업데이트 수행
        try:
            # guru_reports 확장 컬럼 업데이트
            client.table("guru_reports").update(extra_cols).eq("id", report_id).execute()
            success_reports += 1

            # guru_opinions upsert
            if opinion_rows:
                client.table("guru_opinions").upsert(opinion_rows, on_conflict="report_id,persona").execute()
                total_opinions += len(opinion_rows)

            # report_metrics upsert
            if metrics_row:
                client.table("report_metrics").upsert(metrics_row, on_conflict="report_id").execute()
                total_metrics += 1

            if idx % 10 == 0 or idx == len(rows):
                logger.info(f"진행 상황: ({idx}/{len(rows)}) {report_id} 처리 완료")

        except Exception as e:
            logger.warning(f"[{report_id}] 백필 업데이트 실패 (테이블/컬럼 미적용 가능성): {e}")

    logger.info(
        f"백필 완료! 보고서 컬럼 갱신: {success_reports}건, "
        f"개별 평가 행 생성: {total_opinions}건, 핵심 지표 행 생성: {total_metrics}건"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SeedTick 보고서 구조화 백필")
    parser.add_argument("--date", type=str, help="특정 일자 필터 (YYYY-MM-DD)", default=None)
    parser.add_argument("--limit", type=int, help="최대 처리 건수", default=200)
    parser.add_argument("--dry-run", action="store_true", help="DB에 쓰지 않고 검증만 수행")
    args = parser.parse_args()

    asyncio.run(run_backfill(target_date=args.date, limit=args.limit, dry_run=args.dry_run))
