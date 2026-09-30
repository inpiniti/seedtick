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
from app.domains.report.discussion_engine import DiscussionEngine
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


def test_parse_report_verdict_various_formats():
    engine = DiscussionEngine(ai_client=MagicMock())

    # Case 1: TSM 케이스 (볼드 및 괄호 수식어)
    md1 = "> 날짜: 2026-09-25 | 종합 의견: **매수 (적극 분할 진입)** | 표결: 매수 5 · 보유 0 · 관망 8 · 매도 0"
    v1, s1 = engine.parse_report_verdict(md1, fallback_votes={"매수": 5, "관망": 8})
    assert v1 == "매수"
    assert s1 == 0

    # Case 2: 조건부 매수
    md2 = "> 날짜: 2026-09-23 | 종합 의견: **매수 (조건부)** | 표결: 매수 6 · 보유 0 · 관망 7 · 매도 0"
    v2, s2 = engine.parse_report_verdict(md2)
    assert v2 == "매수"
    assert s2 == 0

    # Case 3: 보유 (영문 병기)
    md3 = "> 날짜: 2026-09-24 | 종합 의견: 보유 (Hold-to-Accumulate) | 표결: 매수 4 · 보유 3 · 관망 6 · 매도 0"
    v3, s3 = engine.parse_report_verdict(md3)
    assert v3 == "보유"
    assert s3 == 1

    # Case 4: 관망 (매도우위 병기)
    md4 = "> 날짜: 2026-09-24 | 종합 의견: 관망(매도우위) | 표결: ..."
    v4, s4 = engine.parse_report_verdict(md4)
    assert v4 == "관망"
    assert s4 == 2

    # Case 5: 매도
    md5 = "> 날짜: 2026-09-25 | 종합 의견: **매도** | 표결: ..."
    v5, s5 = engine.parse_report_verdict(md5)
    assert v5 == "매도"
    assert s5 == 3

    # Case 6: 폴백 (헤더에 종합의견 누락 시 fallback_votes 사용)
    md6 = "# TSM 최종 투자 보고서\n> 날짜: 2026-09-25 | 표결: 매수 8 · 보유 0 · 관망 5 · 매도 0"
    v6, s6 = engine.parse_report_verdict(md6, fallback_votes={"매수": 8, "보유": 0, "관망": 5, "매도": 0})
    assert v6 == "매수"
    assert s6 == 0


def test_parse_report_verdict_tsm_hold_regression():
    engine = DiscussionEngine(ai_client=MagicMock())

    # 1. 실제 TSM 보고서 원문 케이스 (헤더 볼드 + 영문 수식어 + 표결은 매수 7 다수)
    raw_md = """# TSM 최종 종합 마스터 투자 보고서
> **날짜**: 2026-09-29 | **종목**: TSM (Taiwan Semiconductor Manufacturing Co.) | **현재가**: $452.88  
> **종합 의견**: **관망 (Hold / Wait for Better Entry)** — *펀더멘털 최상위 1%, 밸류에이션 안전마진 부재, 지정학적 꼬리위험 미반영*  
> **표결**: 매수 7 · 보유 0 · 관망 5 · 매도 2  

---

## 1. 종합 결론

**TSMC는 '사고 싶지만 살 수 없는' 전형적인 딜레마 종목이다.**  
13인의 거장 토론 결과, **펀더멘털 퀄리티(ROE 40%, OPM 50.8%, N3/N2 독점)는 역사적 최강**이나, **진입 가격($452.88)이 '퀄리티 프리미엄'을 넘어 '낙관 프리미엄'까지 선반영**된 구간임이 확인됐다.

*   **강세론(매수 7인)의 핵심**: "AI 반도체 독점적 수혜 + FCF 변곡점 도래(2025년 9,924억 원 → 2026년 1.5조 원 돌파 전망) + 지정학적 공포 할인 과도 = 내재가치 $480~$550".
*   **신중론(관망 5인)의 핵심**: "주인 수익(Owner Earnings) 기준 PER 30배 중반 + FCF 수익률 0.7%(EV 기준)".

**최종 판단**: **'관망(Wait for Fat Pitch)'**. 현재가($452.88)는 **'분할 매수 허용 구간($400~$420)' 상단**이자 **'적극 매수 구간($380 이하, 200일선)' 진입 전**이다.
"""
    fallback = {"매수": 7, "보유": 0, "관망": 5, "매도": 2}
    v, s = engine.parse_report_verdict(raw_md, fallback_votes=fallback)
    assert v == "관망"
    assert s == 2

    # 2. 다양한 마크다운 헤더 변형 테스트
    # 2-1. 콜론이 볼드 안에 있는 경우: **종합 의견:** **관망**
    v_a, s_a = engine.parse_report_verdict("> **종합 의견:** **관망**", fallback_votes=fallback)
    assert v_a == "관망"
    assert s_a == 2

    # 2-2. 띄어쓰기 없는 볼드 라벨: **종합의견**: 관망
    v_b, s_b = engine.parse_report_verdict("> **종합의견**: 관망", fallback_votes=fallback)
    assert v_b == "관망"
    assert s_b == 2

    # 2-3. 최종 투자의견 라벨
    v_c, s_c = engine.parse_report_verdict("> **최종 투자의견**: **매도**", fallback_votes=fallback)
    assert v_c == "매도"
    assert s_c == 3

    # 2-4. 수식어 접두사 테스트 (조건부 관망, 신중 관망, 강력 매도)
    v_pref1, _ = engine.parse_report_verdict("> **종합 의견**: **조건부 관망 (Conditional Watch)**", fallback_votes=fallback)
    assert v_pref1 == "관망"

    v_pref2, _ = engine.parse_report_verdict("> **종합 의견**: **신중 관망 (Cautious Hold)**", fallback_votes=fallback)
    assert v_pref2 == "관망"

    v_pref3, _ = engine.parse_report_verdict("> **종합 의견**: **강력 매도 (Strong Sell)**", fallback_votes=fallback)
    assert v_pref3 == "매도"

    # 2-5. 헤더가 없고 결론 섹션에 "강세론(매수 7인)"과 "최종 판단: '관망'"이 공존하는 경우
    raw_md_conclusion_only = """
## 1. 종합 결론
* 강세론(매수 7인)의 논거가 있었으나
**최종 판단**: **'관망'**으로 결론짓는다.
"""
    v_d, s_d = engine.parse_report_verdict(raw_md_conclusion_only, fallback_votes=fallback)
    assert v_d == "관망"
    assert s_d == 2


@pytest.mark.asyncio
async def test_generate_master_report_prioritizes_llm_verdict():
    mock_ai = MagicMock()
    # TSM 사례 모의: 13인 표결은 매수 5, 관망 8이지만 LLM 종합의견은 매수
    mock_ai.chat = AsyncMock(
        return_value=(
            "# TSM 최종 투자 보고서\n"
            "> 날짜: 2026-09-25 | 종합 의견: **매수 (적극 분할 진입)** | 표결: 매수 5 · 보유 0 · 관망 8 · 매도 0\n\n"
            "## 1. 종합 결론\n"
            "단순 다수결이 아니라 토론에서 압도적이었던 매수 5인의 논거를 채택한다."
        )
    )
    engine = DiscussionEngine(ai_client=mock_ai)

    datapack = StockDataPack(
        ticker="TSM",
        company_name="Taiwan Semiconductor",
        date="2026-09-25",
        current_price=170.0,
        overview="TSM overview",
        balance_sheet=BalanceSheetRow(),
        valuation=ValuationRow(current_price=170.0),
        raw_markdown="# TSM 팩트",
    )
    summaries = GuruSummaryDoc(
        ticker="TSM",
        date="2026-09-25",
        summaries=[],
        raw_markdown="",
    )
    discussion = GuruDiscussionDoc(
        ticker="TSM",
        date="2026-09-25",
        hot_topics=["해자"],
        dialogue="토론",
        final_vote_counts={"매수": 5, "보유": 0, "관망": 8, "매도": 0},
        raw_markdown="",
    )

    report = await engine.generate_master_report(datapack, summaries, discussion)

    # 13인 머릿수(매수 5표)로는 기존 규칙상 "관망"이었으나,
    # B방안(LLM 최종 판단)에 따라 "매수" 및 score 0으로 확정되어야 함
    assert report.overall_verdict == "매수"
    assert report.overall_score == 0


def test_parse_report_valuation():
    mock_ai = MagicMock()
    engine = DiscussionEngine(ai_client=mock_ai)

    # Case 1: 신규 표준 규격 (SKHY 스타일)
    md1 = """
# SKHY 최종 투자 보고서
> **날짜**: 2026-09-29 | **종합 의견**: **조건부 매수** | **표결**: 매수 6 · 보유 1 · 관망 6 · 매도 1
> **현재가**: $181.92 | **종합 적정 내재가치**: $185.00 (적정 밴드: $155 ~ $230)
> **투자 실행 밴드**: [안전마진 매수가] $160 이하 | [중립 적정가] $185 | [목표 매도가] $230

## 1. 종합 결론 및 밸류에이션 산출 근거
- 2025F Forward EPS $xx에 메모리 사이클 멀티플 적용
"""
    res1 = engine.parse_report_valuation(md1)
    assert res1["fair_value_price"] == 185.0
    assert res1["target_price_band"] == "$155 ~ $230"
    assert "$160" in res1["safety_entry_price"]
    assert "$230" in res1["optimistic_target_price"]

    # Case 2: 원화 및 다양한 기호 형식
    md2 = """
# 000660 최종 투자 보고서
> 날짜: 2026-09-29 | 종합의견: 매수
> 현재가: 245,500원 | 종합 적정가: 250,000원 (적정 밴드: 210,000원 - 290,000원)
> 투자 실행 밴드: [안전마진 매수가] 220,000원 이하 | [목표 매도가] 300,000원
"""
    res2 = engine.parse_report_valuation(md2)
    assert res2["fair_value_price"] == 250000.0
    assert "210,000" in res2["target_price_band"]
    assert "220,000" in res2["safety_entry_price"]
    assert "300,000" in res2["optimistic_target_price"]



