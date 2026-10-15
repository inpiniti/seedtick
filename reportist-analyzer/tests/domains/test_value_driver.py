import pytest
from unittest.mock import AsyncMock
from app.domains.report.models import StockDataPack, ValuationRow
from app.domains.report.value_driver_generator import ValueDriverGenerator


@pytest.fixture
def sample_datapack():
    return StockDataPack(
        ticker="AMAT",
        company_name="Applied Materials, Inc.",
        date="2026-09-29",
        current_price=210.5,
        currency="USD",
        financial_currency="USD",
        overview="반도체 전공정 장비 세계 1위 업체.",
        valuation=ValuationRow(
            current_price=210.5,
            trailing_pe=24.5,
            forward_pe=19.2,
            market_cap=175000000000.0,
        ),
        news_items=[
            {
                "title": "Applied Materials expands HBM packaging portfolio",
                "publisher": "Reuters",
                "link": "https://example.com/amat-news",
                "published_at": "2026-09-28 10:00",
            }
        ],
    )


@pytest.mark.asyncio
async def test_value_driver_generator_success(tmp_path, sample_datapack):
    mock_ai = AsyncMock()
    mock_ai.chat.return_value = """# AMAT 가치 드라이버 분석
## 핵심 드라이버 3~5개 (표 형식)
| # | 드라이버명 | 현재 상태 | 변화 감시 기준 | 중요도 |
|---|---|---|---|---|
| 1 | DRAM/HBM 장비 수요 확대 | 점유율 1위 | HBM4 전환 및 캐펙스 집행 | 높음 |
"""
    generator = ValueDriverGenerator(ai_client=mock_ai, base_report_dir=tmp_path)
    result = await generator.generate_value_drivers(sample_datapack, "2026-09-29")

    assert "DRAM/HBM 장비 수요 확대" in result
    out_file = tmp_path / "2026-09-29" / "_data" / "AMAT_VALUE_DRIVERS.md"
    assert out_file.exists()
    assert "AMAT 가치 드라이버 분석" in out_file.read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_value_driver_generator_fallback_on_error(tmp_path, sample_datapack):
    mock_ai = AsyncMock()
    mock_ai.chat.side_effect = Exception("AI Gateway Timeout")

    generator = ValueDriverGenerator(ai_client=mock_ai, base_report_dir=tmp_path)
    result = await generator.generate_value_drivers(sample_datapack, "2026-09-29")

    assert "AMAT 가치 드라이버 분석" in result
    assert "기본 펀더멘털 기반 생성" in result
    out_file = tmp_path / "2026-09-29" / "_data" / "AMAT_VALUE_DRIVERS.md"
    assert out_file.exists()
