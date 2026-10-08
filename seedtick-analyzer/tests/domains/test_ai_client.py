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


@pytest.mark.asyncio
async def test_ai_client_integrated_slot_rotation():
    # 2개 제공사(OpenRouter, Kilo) 다중 키 등록 시 교차(interleaving) 배치 검증
    client = AiGatewayClient(
        api_keys=["or-1", "or-2", "or-3"],
        kilo_keys=["kilo-1", "kilo-2"],
    )
    assert len(client.slots) == 5
    # OR -> Kilo -> OR -> Kilo -> OR 교차 순서 확인
    slot_providers = [s.provider for s in client.slots]
    assert slot_providers == [
        "OpenRouter", "Kilo",
        "OpenRouter", "Kilo",
        "OpenRouter"
    ]

    # 라운드로빈 획득 검증
    s1 = await client._get_next_slot()
    s2 = await client._get_next_slot()
    s3 = await client._get_next_slot()
    s4 = await client._get_next_slot()
    assert s1.key == "or-1" and s1.provider == "OpenRouter"
    assert s2.key == "kilo-1" and s2.provider == "Kilo"
    assert s3.key == "or-2" and s3.provider == "OpenRouter"
    assert s4.key == "kilo-2" and s4.provider == "Kilo"


@pytest.mark.asyncio
async def test_ai_client_fallback_chain():
    # OpenRouter 키와 Kilo 키 등록
    client = AiGatewayClient(
        api_keys=["or-key1"],
        kilo_keys=["kilo-key1"],
    )
    assert len(client.active_providers) == 2
    assert len(client.slots) == 2
    assert client.slots[0].provider == "OpenRouter"
    assert client.slots[1].provider == "Kilo"

    # OpenRouter는 429 에러, Kilo는 200 성공 반환 모의
    resp_429 = MagicMock()
    resp_429.status_code = 429
    resp_429.text = "Rate limited"

    resp_200 = MagicMock()
    resp_200.status_code = 200
    resp_200.json.return_value = {
        "choices": [{"message": {"content": "Kilo에서 생성된 응답"}, "finish_reason": "stop"}],
        "usage": {"total_tokens": 100},
    }

    # OpenRouter 429 감지 즉시 다음 슬롯(Kilo)으로 전환되어 2번째에 성공
    side_effects = [resp_429, resp_200]

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=side_effects) as mock_post:
        result = await client.chat("테스트 프롬프트")
        assert result == "Kilo에서 생성된 응답"
        # 1회(OR 429) + 1회(Kilo 200) = 총 2회 호출로 즉시 복구
        assert mock_post.await_count == 2



@pytest.mark.asyncio
async def test_ai_client_empty_choices_and_error_obj_retry():
    client = AiGatewayClient(api_keys=["or-key1"])

    # 1번째 호출: 200 OK 내부에 error 객체 반환
    resp_error_obj = MagicMock()
    resp_error_obj.status_code = 200
    resp_error_obj.json.return_value = {"error": {"code": 503, "message": "Upstream unavailable"}}

    # 2번째 호출: 200 OK choices 빈 배열
    resp_empty_choices = MagicMock()
    resp_empty_choices.status_code = 200
    resp_empty_choices.json.return_value = {"choices": []}
    resp_empty_choices.text = '{"choices": []}'

    # 3번째 호출: 정상 성공
    resp_success = MagicMock()
    resp_success.status_code = 200
    resp_success.json.return_value = {
        "choices": [{"message": {"content": "재시도 후 성공"}, "finish_reason": "stop"}]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=[resp_error_obj, resp_empty_choices, resp_success]):
        result = await client.chat("테스트")
        assert result == "재시도 후 성공"


@pytest.mark.asyncio
async def test_ai_client_reasoning_content_fallback():
    client = AiGatewayClient(api_keys=["or-key1"])

    # content는 비어 있고 reasoning_content만 들어있는 thinking 모델 응답
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "content": "",
                    "reasoning_content": "사고 과정이지만 응답 본문으로 채택됨",
                },
                "finish_reason": "stop",
            }
        ]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=resp):
        result = await client.chat("테스트")
        assert result == "사고 과정이지만 응답 본문으로 채택됨"


@pytest.mark.asyncio
async def test_ai_client_wrapped_data_response():
    client = AiGatewayClient(api_keys=["or-key1"])

    # Cline 등 일부 제공자가 {"data": {"choices": [...]}} 형태로 감싸서 응답하는 경우 언래핑 검증
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "data": {
            "choices": [
                {
                    "message": {
                        "content": "Cline 언래핑 성공 응답",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {"total_tokens": 50},
        }
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=resp):
        result = await client.chat("테스트 프롬프트")
        assert result == "Cline 언래핑 성공 응답"


@pytest.mark.asyncio
async def test_ai_client_updates_active_model_after_rotation():
    client = AiGatewayClient(api_keys=["or-key1"])
    initial_model = client.model

    resp_model_error = MagicMock()
    resp_model_error.status_code = 200
    resp_model_error.json.return_value = {
        "error": {"code": 503, "message": "Upstream unavailable"}
    }

    resp_success = MagicMock()
    resp_success.status_code = 200
    resp_success.json.return_value = {
        "choices": [{"message": {"content": "회전 후 성공"}, "finish_reason": "stop"}]
    }

    with (
        patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=[resp_model_error, resp_success]),
        patch("app.domains.report.ai_client.model_rotation.advance", return_value="fallback-model") as mock_advance,
        patch("app.domains.report.ai_client.model_rotation.note_success") as mock_note_success,
    ):
        result = await client.chat("테스트")

    assert result == "회전 후 성공"
    mock_advance.assert_called_once()
    assert mock_advance.call_args.args[0] == initial_model
    mock_note_success.assert_called_once_with("fallback-model")


@pytest.mark.asyncio
async def test_ai_client_real_streaming_sse_chunks():
    """실시간 SSE 스트리밍 토큰 누적 수집 검증"""
    import contextlib

    client = AiGatewayClient(api_keys=["or-key1"])

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp._is_stream = True

    sse_lines = [
        'data: {"choices": [{"delta": {"content": "안녕"}, "finish_reason": null}]}',
        'data: {"choices": [{"delta": {"content": "하세요 "}, "finish_reason": null}]}',
        'data: {"choices": [{"delta": {"content": "SeedTick!"}, "finish_reason": "stop"}]}',
        'data: [DONE]',
    ]

    async def _mock_aiter():
        for line in sse_lines:
            yield line

    mock_resp.aiter_lines = _mock_aiter

    @contextlib.asynccontextmanager
    async def mock_stream(*args, **kwargs):
        yield mock_resp

    with patch("httpx.AsyncClient.stream", side_effect=mock_stream) as mock_st:
        result = await client.chat("인사해줘")
        assert result == "안녕하세요 SeedTick!"
        mock_st.assert_called_once()
        # 스트리밍 요청 파라미터 검증
        call_kwargs = mock_st.call_args.kwargs
        assert call_kwargs["json"]["stream"] is True
        assert call_kwargs["headers"]["Accept"] == "text/event-stream"


@pytest.mark.asyncio
async def test_ai_client_ttft_read_timeout_fallback():
    """Kilo 무응답(ReadTimeout/Hang) 발생 시 20초 타임아웃 감지 후 다음 슬롯으로 즉시 전환 검증"""
    import contextlib

    client = AiGatewayClient(
        kilo_keys=["kilo-hang-key"],
        api_keys=["or-success-key"],
    )
    # 슬롯 순서: OR -> Kilo (또는 interleaving)
    assert len(client.slots) == 2

    mock_resp_success = MagicMock()
    mock_resp_success.status_code = 200
    mock_resp_success._is_stream = True

    async def _mock_aiter():
        yield 'data: {"choices": [{"delta": {"content": "OpenRouter에서 성공"}, "finish_reason": "stop"}]}'
        yield 'data: [DONE]'

    mock_resp_success.aiter_lines = _mock_aiter

    call_count = 0

    @contextlib.asynccontextmanager
    async def mock_stream(method, url, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise httpx.ReadTimeout("The read operation timed out (20s TTFT)")
        yield mock_resp_success

    with patch("httpx.AsyncClient.stream", side_effect=mock_stream):
        result = await client.chat("분석해줘")
        assert result == "OpenRouter에서 성공"
        assert call_count == 2

