"""
로고 워밍업 서비스 및 Toss info API deviceId 쿠키 회귀 테스트
"""
import pytest

import app.domains.screener.clients.toss_wts as toss_module
import app.domains.screener.logo_warmup_service as warmup_module
from app.domains.screener.clients.toss_wts import TossWtsClient
from app.domains.screener.logo_warmup_service import LogoWarmupService


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200):
        self._payload = payload
        self.status_code = status_code

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    """httpx.AsyncClient 대역: 전달된 kwargs(쿠키 포함)를 기록한다."""

    instances: list["_FakeAsyncClient"] = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.requests: list[tuple[str, str]] = []
        _FakeAsyncClient.instances.append(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    async def post(self, url, json=None, **kwargs):
        self.requests.append(("POST", url))
        return _FakeResponse({"result": {"stocks": [{"stockCode": "US19801212001"}]}})

    async def get(self, url, **kwargs):
        self.requests.append(("GET", url))
        return _FakeResponse({"result": [{"code": "US19801212001", "symbol": "AAPL"}]})


@pytest.mark.asyncio
async def test_toss_info_clients_send_device_id_cookie(monkeypatch):
    """wts-info-api는 deviceId 쿠키가 없으면 400 invalid-client-state를 반환한다."""
    _FakeAsyncClient.instances = []
    monkeypatch.setattr(toss_module.httpx, "AsyncClient", _FakeAsyncClient)

    client = TossWtsClient()
    stocks = await client.search_stocks("AAPL")
    infos = await client._fetch_stock_infos_by_codes(["US19801212001"])

    assert stocks == [{"stockCode": "US19801212001"}]
    assert infos == [{"code": "US19801212001", "symbol": "AAPL"}]
    assert len(_FakeAsyncClient.instances) == 2
    for instance in _FakeAsyncClient.instances:
        assert instance.kwargs.get("cookies") == {"deviceId": client._device_id}
        assert instance.kwargs["cookies"]["deviceId"].startswith("WTS-")


class _FakeLogoService:
    """네트워크/DB 호출 없이 로고 서비스 동작을 대체한다."""

    def __init__(
        self,
        cached_logo: str | None = None,
        cached_name: str | None = None,
        resolved_logo: str | None = None,
        resolved_name: str | None = None,
    ):
        self.cached_logo = cached_logo
        self.cached_name = cached_name
        self.resolved_logo = resolved_logo
        self.resolved_name = resolved_name
        self.resolve_logo_calls = 0
        self.resolve_name_calls = 0

    def get_cached_logo(self, ticker: str) -> str | None:
        return self.cached_logo

    def get_cached_names(self, tickers: list[str]) -> dict[str, str]:
        if self.cached_name:
            return {tickers[0]: self.cached_name}
        return {}

    async def resolve_logo(self, ticker: str) -> tuple[str | None, str]:
        self.resolve_logo_calls += 1
        source = "toss_lookup" if self.resolved_logo else "none"
        return self.resolved_logo, source

    async def resolve_name(self, ticker: str) -> tuple[str | None, str]:
        self.resolve_name_calls += 1
        source = "toss_lookup" if self.resolved_name else "none"
        return self.resolved_name, source


def _make_service(monkeypatch, **kwargs) -> LogoWarmupService:
    monkeypatch.setattr(
        warmup_module.supabase_repo,
        "_korean_name_column_missing",
        False,
        raising=False,
    )
    return LogoWarmupService(**kwargs)


@pytest.mark.asyncio
async def test_logo_warmup_marks_failed_when_nothing_resolved(monkeypatch):
    """로고/한글명 모두 미발견이면 실패 쿨다운에 기록한다."""
    service = _make_service(monkeypatch, failure_cooldown_sec=3600)
    service.logo_service = _FakeLogoService()

    await service._process_ticker("AAPL")

    assert "AAPL" in service._failed_until
    assert service._failed_until["AAPL"] > 0


@pytest.mark.asyncio
async def test_logo_warmup_clears_failure_when_logo_resolved(monkeypatch):
    service = _make_service(monkeypatch)
    service.logo_service = _FakeLogoService(
        resolved_logo="https://static.toss.im/png-icons/securities/logo.png"
    )
    service._mark_failed("AAPL")

    await service._process_ticker("AAPL")

    assert "AAPL" not in service._failed_until


@pytest.mark.asyncio
async def test_logo_warmup_clears_failure_when_name_resolved(monkeypatch):
    service = _make_service(monkeypatch)
    service.logo_service = _FakeLogoService(resolved_name="애플")
    service._mark_failed("AAPL")

    await service._process_ticker("AAPL")

    assert "AAPL" not in service._failed_until


@pytest.mark.asyncio
async def test_logo_warmup_skips_cached_ticker_without_toss_call(monkeypatch):
    service = _make_service(monkeypatch)
    service.logo_service = _FakeLogoService(
        cached_logo="https://static.toss.im/png-icons/securities/logo.png",
        cached_name="애플",
    )

    await service._process_ticker("AAPL")

    assert service.logo_service.resolve_logo_calls == 0
    assert service.logo_service.resolve_name_calls == 0
    assert "AAPL" not in service._failed_until


@pytest.mark.asyncio
async def test_logo_warmup_enqueue_skips_failed_ticker_during_cooldown(monkeypatch):
    """쿨다운 중인 종목은 시드 재적재 시 건너뛴다."""
    service = _make_service(monkeypatch, failure_cooldown_sec=3600)
    service._mark_failed("AAPL")

    await service.enqueue_tickers(["AAPL", "MSFT"])

    assert list(service._queue) == ["MSFT"]


@pytest.mark.asyncio
async def test_logo_warmup_enqueue_retries_after_cooldown(monkeypatch):
    """쿨다운이 만료된 종목은 다시 큐에 적재하고 실패 기록을 지운다."""
    service = _make_service(monkeypatch, failure_cooldown_sec=1)
    service._failed_until["AAPL"] = 0.0  # 이미 만료된 쿨다운

    await service.enqueue_tickers(["AAPL"])

    assert list(service._queue) == ["AAPL"]
    assert "AAPL" not in service._failed_until


@pytest.mark.asyncio
async def test_logo_warmup_reseed_is_throttled(monkeypatch):
    """큐가 비었을 때 보고서 티커 재조회는 reseed_interval_sec 내에서 1회만 수행한다."""
    service = _make_service(monkeypatch, reseed_interval_sec=3600)
    calls: list[int] = []

    def fake_list_report_tickers(limit: int = 2000) -> list[str]:
        calls.append(limit)
        return ["AAPL"]

    monkeypatch.setattr(
        warmup_module.supabase_repo,
        "list_report_tickers",
        fake_list_report_tickers,
    )

    await service._seed_from_reports()
    await service._seed_from_reports()

    assert calls == [service.max_seed_tickers]
    assert list(service._queue) == ["AAPL"]
