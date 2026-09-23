"""
GuruReportService 5단계 파이프라인 및 DB 동기화 단위 테스트
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from pathlib import Path
from app.domains.report.models import (
    BalanceSheetRow,
    FinalMasterReport,
    GuruDiscussionDoc,
    GuruSummaryDoc,
    PersonaSummaryBlock,
    StockDataPack,
    ValuationRow,
)
from app.domains.report.service import GuruReportService


@pytest.mark.asyncio
async def test_guru_report_service_pipeline(tmp_path: Path):
    # Mock DataPackBuilder
    mock_builder = MagicMock()
    mock_datapack = StockDataPack(
        ticker="AAPL",
        company_name="Apple Inc.",
        date="2026-09-23",
        current_price=220.0,
        overview="Apple overview",
        balance_sheet=BalanceSheetRow(),
        valuation=ValuationRow(current_price=220.0),
        raw_markdown="# AAPL 팩트",
    )
    mock_builder.build = AsyncMock(return_value=mock_datapack)

    # Mock AI Client
    mock_ai = MagicMock()
    mock_ai.chat = AsyncMock(
        return_value="인물: 워런-버핏 | 의견: 매수 | 확신도: 9\n핵심 논거:\n- 강력한 해자\n적정가/매수 가격대: $250\n대표 발언: 훌륭한 비즈니스다."
    )

    # Mock Supabase Repo
    mock_supabase = MagicMock()
    mock_supabase.save_full_report = AsyncMock(return_value=True)
    mock_supabase.save_guru_votes = AsyncMock(return_value=True)

    service = GuruReportService(
        datapack_builder=mock_builder,
        ai_client=mock_ai,
        supabase_repo=mock_supabase,
        base_report_dir=tmp_path,
        request_interval=0,
    )

    # Mock Discussion Engine 메서드
    service.discussion_engine.generate_discussion = AsyncMock(
        return_value=GuruDiscussionDoc(
            ticker="AAPL",
            date="2026-09-23",
            hot_topics=["해자", "밸류"],
            dialogue="# 토론 내용",
            final_vote_counts={"매수": 10, "보유": 2, "관망": 1, "매도": 0},
            raw_markdown="# 토론 마크다운",
        )
    )
    service.discussion_engine.generate_master_report = AsyncMock(
        return_value=FinalMasterReport(
            ticker="AAPL",
            date="2026-09-23",
            overall_verdict="매수",
            overall_score=0,
            vote_summary="매수 10 · 보유 2 · 관망 1 · 매도 0",
            bull_case="성장",
            bear_case="리스크",
            raw_markdown="# 최종 보고서 마크다운",
        )
    )

    report = await service.generate_full_report("AAPL", "2026-09-23")

    # 1. 반환값 검증
    assert report.ticker == "AAPL"
    assert report.overall_verdict == "매수"
    assert report.overall_score == 0

    # 2. Supabase 양대 테이블 동시 저장 검증
    mock_supabase.save_full_report.assert_awaited_once()
    mock_supabase.save_guru_votes.assert_awaited_once()

    # 3. 로컬 마크다운 파일 저장 검증
    assert (tmp_path / "2026-09-23" / "_data" / "AAPL_요약.md").exists()
    assert (tmp_path / "2026-09-23" / "최종" / "AAPL_토론.md").exists()
    assert (tmp_path / "2026-09-23" / "최종" / "AAPL_최종보고서.md").exists()
