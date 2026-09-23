# Bridge 함수 명세

## IBrokerAdapter (추상 클래스)

```python
class IBrokerAdapter(ABC):
    @abstractmethod
    async def get_balance(self) -> BrokerBalance: ...

    @abstractmethod
    async def place_order(self, order: BrokerOrder) -> OrderResult: ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool: ...

    @abstractmethod
    async def get_quote(self, ticker: str) -> float: ...
```

## TossAdapter

KIS API와 유사하나, 토스증권 전용 엔드포인트 사용.

**주요 처리**:
- USD/KRW 환율 계산 (amount_krw → 달러 수량)
- 토스 인증 토큰 캐싱 (만료 전 자동 갱신)

## KisAdapter

기존 KIS Open API 연동 코드를 어댑터로 래핑.

**주요 처리**:
- 해외주식 매수 (`/uapi/overseas-stock/v1/trading/order`)
- 토큰 만료 전 갱신

---

## 어댑터 선택 (팩토리)

```python
def get_broker_adapter(broker: str) -> IBrokerAdapter:
    adapters = {
        "toss": TossAdapter,
        "kis": KisAdapter,
    }
    cls = adapters.get(broker)
    if not cls:
        raise ValueError(f"지원하지 않는 증권사: {broker}")
    return cls(api_key=settings.get_broker_key(broker))
```
