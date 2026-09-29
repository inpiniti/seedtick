"""
AiGatewayClient 직접 호출 및 키 로테이션, 페르소나 프롬프트 고도화 단위 테스트
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from app.domains.report.ai_client import AiGatewayClient
from app.domains.report.personas.prompts import GURU_PERSONAS, build_persona_prompt
from app.domains.report.models import StockDataPack, ValuationRow, BalanceSheetRow
from app.domains.report.datapack_builder import DataPackBuilder


def test_ai_client_mode_selection():
    # 1. api_keys가 있을 때 -> 직접 호출 모드
    client_direct = AiGatewayClient(api_keys=["key1", "key2"])
    assert client_direct.use_direct is True
    assert client_direct.base_url == "https://openrouter.ai/api/v1/chat/completions"
    assert client_direct.api_keys == ["key1", "key2"]
    assert client_direct.max_tokens == 32768

    # 2. api_keys가 없고 base_url이 명시되었을 때 -> 게이트웨이 모드
    client_gw = AiGatewayClient(base_url="http://test-gateway:3000", api_keys=[])
    assert client_gw.use_direct is False
    assert client_gw.base_url == "http://test-gateway:3000"


@pytest.mark.asyncio
async def test_ai_client_key_rotation():
    keys = ["sk-key1", "sk-key2", "sk-key3"]
    client = AiGatewayClient(api_keys=keys)

    # 3회 순환하면서 키가 라운드로빈 되는지 확인
    k1 = await client._get_next_key()
    k2 = await client._get_next_key()
    k3 = await client._get_next_key()
    k4 = await client._get_next_key()

    assert k1 == "sk-key1" or k1 in keys
    # 연속 호출 시 순환됨
    fetched = [k1, k2, k3, k4]
    assert len(set(fetched[:3])) == 3
    assert fetched[3] == fetched[0]


@pytest.mark.asyncio
async def test_ai_client_direct_chat_success():
    client = AiGatewayClient(api_keys=["sk-testkey123"])

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {"content": "성공적인 분석 결과입니다."},
                "finish_reason": "stop",
            }
        ],
        "usage": {"total_tokens": 120, "completion_tokens": 80},
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_resp) as mock_post:
        result = await client.chat("종목을 분석해줘")
        assert result == "성공적인 분석 결과입니다."
        mock_post.assert_awaited_once()

        # 호출 파라미터 검증
        call_kwargs = mock_post.call_args.kwargs
        payload = call_kwargs["json"]
        headers = call_kwargs["headers"]

        assert payload["max_tokens"] == 32768
        assert "Bearer sk-testkey123" in headers["Authorization"]
        assert headers["HTTP-Referer"] == "https://seedtick.app"


def test_guru_personas_coverage():
    # 13인의 거장 및 뉴욕주민/찰리멍거가 모두 포함되어 있는지 확인
    expected_gurus = [
        "워런-버핏", "찰리-멍거", "뉴욕주민", "피터-린치", "필립-피셔",
        "벤저민-그레이엄", "세스-클라먼", "조엘-그린블라트", "존-템플턴",
        "앙드레-코스톨라니", "마이클-버리", "모니시-파브라이", "잭-슈웨거",
        "애스워스-다모다란",
    ]
    for guru in expected_gurus:
        assert guru in GURU_PERSONAS
        info = GURU_PERSONAS[guru]
        assert "philosophy" in info
        assert "focus" in info
        assert len(info["focus"]) > 20  # 상세한 체크리스트가 존재하는지 확인

    # 프롬프트 생성 테스트
    prompt = build_persona_prompt("워런-버핏", "# 가상의 데이터팩")
    assert "워런 버핏" in prompt
    assert "경제적 해자" in prompt
    assert "# 가상의 데이터팩" in prompt
    # 300자 제한 규칙이 사라졌는지 확인
    assert "300자 이내로 엄격히 제한" not in prompt


def test_datapack_builder_renders_ir_schedule():
    dp_builder = DataPackBuilder()
    dp = StockDataPack(
        ticker="TSM",
        company_name="Taiwan Semiconductor",
        date="2026-09-29",
        current_price=175.0,
        overview="파운드리 반도체 제조 기업",
        balance_sheet=BalanceSheetRow(),
        valuation=ValuationRow(current_price=175.0),
        ir_schedule={
            "차기 실적 발표 예정일": "2026-10-15",
            "배당 기준일(Ex-Dividend)": "2026-09-12",
        },
        news_items=[
            {"title": "TSMC 2nm 수율 급증 발표", "publisher": "Bloomberg", "published_at": "2026-09-28 10:00"}
        ],
    )
    md = dp_builder._render_markdown(dp)
    assert "## 5. 최신 주요 뉴스 및 IR 일정 (Catalysts & Events)" in md
    assert "차기 실적 발표 예정일" in md
    assert "2026-10-15" in md
    assert "TSMC 2nm 수율 급증 발표" in md
