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


def test_parse_summary_block_various_formats():
    service = GuruReportService()

    # Case 1: 볼드 마크다운 및 불릿
    text1 = """
    인물: 워런-버핏 | **의견**: 매수 | **확신도**: 8
    
    **핵심 논거:**
    - ROE가 92.7%로 기준치 15%를 대폭 상회하며 순이익 42조원 달성
    - 영업이익률 48.6%로 메모리 사이클 상승기 고수익 입증
    
    **적정가/매수 가격대:** $210~$240
    **트리거 조건:** HBM 점유율 유지 여부
    **대표 발언:** "좋은 비즈니스를 합리적인 가격에 매수하는 기회다."
    """
    block1 = service._parse_summary_block("워런-버핏", text1)
    assert block1.verdict == "매수"
    assert block1.confidence == 8
    assert len(block1.core_arguments) == 2
    assert "ROE가 92.7%" in block1.core_arguments[0]
    assert block1.target_price_range == "$210~$240"
    assert "좋은 비즈니스" in block1.quote

    # Case 2: 불릿 없이 문단 형태 출력
    text2 = """
    인물: 찰리-멍거 | 의견: 보유 | 확신도: 7

    핵심 논거:
    ROE 34.0%와 영업이익률 46.8%는 소프트웨어 인프라 분야에서 독보적인 경제적 해자를 입증한다.
    부채비율 0.13x로 재무 구조가 견고하여 치명적인 바보짓의 위험이 거의 없다.

    대표 발언: 역발상으로 보면 매력적인 기업이다.
    """
    block2 = service._parse_summary_block("찰리-멍거", text2)
    assert block2.verdict == "보유"
    assert block2.confidence == 7
    assert len(block2.core_arguments) >= 2
    assert "경제적 해자" in block2.core_arguments[0]
    assert "역발상" in block2.quote

