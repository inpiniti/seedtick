# Screener 함수 명세
 
## ScreenerService
 
### `get_stock_list(criteria: ScreenCriteria = ScreenCriteria()) -> ScreenResult`
 
메인 스크리닝 함수. 토스증권 비공개 WTS API를 직접 호출하여 13인 거장 공통 필터를 통과한 미국 주식 리스트를 반환합니다.
 
**호출 절차**:
1. `TossWtsClient.screen_common_us(size, page)` 호출
   - `GET https://wts-api.tossinvest.com/api/v3/init` → XSRF-TOKEN 및 deviceId 쿠키 수령
   - `POST https://wts-cert-api.tossinvest.com/api/v2/screener/screen` → 거장 공통 필터 JSON 전송
   - `GET https://wts-info-api.tossinvest.com/api/v2/stock-infos?codes=...` → productCode를 실제 심볼(티커)로 변환
2. 제외 목록(`exclude_tickers`) 필터링
3. `ScreenResult` 생성 및 반환
 
**에러 처리**:
- WTS API 호출 실패 시 `SCREENER_FETCH_FAILED` 에러 발생
- 필터 통과 종목 0개 시 `SCREENER_EMPTY_RESULT` 경고 로그
 
---
 
## BtcAiTossClient
 
`bitcoin-ai-backend`의 이미 배포된 토스 스크리너 라우터를 활용합니다.
 
```python
class BtcAiTossClient:
    async def get_guru_screener(self, guru: str = "공통", nation: str = "us", size: int = 200) -> dict:
        """GET /toss/{guru}?nation={nation}&size={size}"""
        ...
```
 
---
 
## TossWtsClient (Fallback)
 
백엔드 장애 시 직접 토스 WTS 비공개 API를 호출하여 세션을 유지하고 결과를 파싱합니다.
 
1. `GET https://wts-api.tossinvest.com/api/v3/init` → XSRF-TOKEN 및 쿠키 수령 (deviceId 자체 생성)
2. `POST https://wts-cert-api.tossinvest.com/api/v2/screener/screen` → 거장 공통 필터 JSON 전송
3. `GET https://wts-info-api.tossinvest.com/api/v2/stock-infos?codes=...` → productCode를 실제 심볼(티커)로 변환

