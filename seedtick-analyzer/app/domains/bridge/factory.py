"""
브로커 어댑터 팩토리 (Mock, Toss, Kis)
"""
from app.config.settings import settings
from app.domains.bridge.interface import IBrokerAdapter
from app.domains.bridge.adapters.mock import MockBrokerAdapter
from app.domains.bridge.adapters.toss import TossBrokerAdapter
from app.domains.bridge.adapters.kis import KisBrokerAdapter


def get_broker_adapter(broker_name: str | None = None) -> IBrokerAdapter:
    name = (broker_name or settings.DEFAULT_BROKER).lower().strip()

    if name == "mock":
        return MockBrokerAdapter()
    elif name == "toss":
        return TossBrokerAdapter()
    elif name == "kis":
        return KisBrokerAdapter()
    else:
        raise ValueError(f"지원하지 않는 브로커: {broker_name} (mock, toss, kis 중 선택)")
