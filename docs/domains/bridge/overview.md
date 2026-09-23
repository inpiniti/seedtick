# Bridge 도메인 개요

## 역할

증권사별 API(토스증권, 한국투자증권)를 단일 인터페이스(`IBrokerAdapter`)로 추상화하는 **독립 증권사 연동 라이브러리(Broker Bridge Library)**입니다.

## 아키텍처 결정: 별도 Lib 분리 전략

**Q. 별도 Lib로 분리가 맞는가?**
**A. 네, 독립 Python 라이브러리(패키지)로 분리하는 것이 맞습니다.**

- **네트워크 서비스(별도 HTTP 서버)로 분리 X**: 주문 발주와 잔고 확인의 지연 시간(레이턴시) 최소화 및 프로세스 장애 포인트 제거를 위해 HTTP 서버가 아닌 인메모리 라이브러리로 연동합니다.
- **독립 Lib(패키지)로 분리 O**: `seedtick-analyzer`의 분석/스케줄링 비즈니스 로직과 증권사 통신 로직을 완전히 격리하기 위해 `packages/seedtick-bridge` (또는 `src/bridge/`의 독립 패키지 구조)로 분리합니다.
  - 이를 통해 단위 테스트, Mock Broker 교체, CLI 및 다른 서비스에서의 재사용이 매우 쉬워집니다.

## 지원 증권사 및 연동 스펙

| 증권사 | 어댑터 | 정본 문서 위치 | 핵심 규칙 요약 |
|:---|:---|:---|:---|
| **토스증권** | `TossBrokerAdapter` | `financial-desktop/docs/toss open api` | • OAuth2 client_credentials (client당 유효 토큰 1개, 재발급 시 이전 토큰 무효)<br>• 허용 IP 필수 등록 (미등록 시 403)<br>• 계좌 헤더 `X-Tossinvest-Account: {accountSeq}`<br>• 요청 간격 120ms, 429 시 Retry-After 백오프<br>• 미국 주식 정정은 가격만 가능 (수량 주면 400), 정정/취소 시 새 orderId 발급 |
| **한국투자증권** | `KisBrokerAdapter` | `financial-app/docs/koreainvestment` | • AppKey/Secret 기반 접근 토큰 24시간 유효 캐싱<br>• 계좌번호 체계 (8자리-2자리 상품코드)<br>• 해외주식 실시간 시세 및 주문 TR (`TTTT1002U` 등)<br>• 통화별(USD) 잔고 및 예수금 매핑 |

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
- [주문 인터페이스 계약](../../contract/order-interface.md)
