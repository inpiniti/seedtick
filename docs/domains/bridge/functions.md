# Bridge 함수 명세

## IBrokerAdapter (통일 추상 인터페이스)

```python
from abc import ABC, abstractmethod

class IBrokerAdapter(ABC):
    @abstractmethod
    async def get_balance(self) -> BrokerBalance:
        """예수금(원화/외화) 및 보유 포지션 조회"""
        ...

    @abstractmethod
    async def place_order(self, order: BrokerOrder) -> OrderResult:
        """미국 주식 시장가 주문 발주 (소액 금액 지정 매수)"""
        ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """미체결 주문 취소"""
        ...

    @abstractmethod
    async def get_quote(self, ticker: str) -> float:
        """실시간 현재가(USD) 조회"""
        ...
```

---

## 1. TossBrokerAdapter (`financial-desktop/docs/toss open api` 기반)

- **인증**:
  - `POST /oauth2/token` (grant_type=client_credentials, form-urlencoded)
  - `expires_in` 86400초, refresh 토큰 없음.
  - **주의**: Client당 유효 토큰은 1개(신규 발급 시 이전 토큰 무효). 인메모리에 캐시 후 만료 임박(30분 전) 시 갱신.
- **요청 헤더**:
  - `Authorization: Bearer {token}`
  - `X-Tossinvest-Account: {accountSeq}` (계좌 관련 API 필수)
- **레이트리밋 & 재시도**:
  - 그룹별 최소 간격 120ms 유지.
  - 429 수신 시 `Retry-After` 헤더 기반 지수 백오프 3회.
  - 401 수신 시 토큰 강제 재발급 1회 후 재시도.
- **주문 규칙**:
  - `POST /orders` (LIMIT / MARKET)
  - `clientOrderId` (UUID)로 10분간 멱등성 보장.
  - 가격 소수점: $1 미만 4자리, $1 이상 2자리 절삭.
  - 정정/취소: 미국 주식 정정 시 `quantity`를 주면 400 에러(가격만 정정 가능). 정정/취소 성공 시 서버가 새로운 `orderId` 발급.

---

## 2. KisBrokerAdapter (`financial-app/docs/koreainvestment` 기반)

- **인증**:
  - `POST /oauth2/tokenP` (grant_type=client_credentials, appkey, appsecret)
  - 유효기간 24시간 캐싱 (재발급 제한 주의).
- **요청 헤더**:
  - `authorization: Bearer {token}`
  - `appkey`, `appsecret`
  - `tr_id`: 거래 고유 ID (예: 해외주식 매수 주문 `TTTT1002U`, 잔고조회 `TTTS3012R`)
- **계좌 번호 체계**:
  - `CANO` (계좌 앞 8자리) + `ACNT_PRDT_CD` (계좌 뒤 2자리 상품코드)
- **통화 및 정산**:
  - 해외주식 주문 시 종목코드 및 거래소코드 (NASD, NYSE, AMEX 등) 매핑 필요.
  - 외화 매수가능금액 및 원화 통합증거금 확인 후 수량 계산.

---

## 3. MockBrokerAdapter

로컬 테스트 및 `--dry-run` 모드용 가상 브로커:
- 실제 자금 차감 없이 가상 잔고(`available_krw: 1,000,000`)에서 주문 시뮬레이션
- `OrderResult(success=True, executed_price=현재가, executed_qty=계산수량)` 즉시 반환

