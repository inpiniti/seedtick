# Bridge 도메인 개요

## 역할

증권사별 API를 하나의 통일된 인터페이스로 추상화하는 내장 라이브러리입니다.

## 특징

- **서버 아님** — 네트워크 서비스가 아닌 `seedtick-analyzer` 내부 라이브러리
- **개방-폐쇄 원칙** — `IBrokerAdapter`를 구현하면 어떤 증권사도 추가 가능
- **어댑터 패턴** — 각 증권사 API의 차이를 어댑터가 흡수

## 지원 증권사

| 증권사 | 어댑터 | 상태 |
|:---|:---|:---:|
| 토스증권 | `TossAdapter` | 구현 예정 |
| 한국투자증권 (KIS) | `KisAdapter` | 구현 예정 |

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
- [주문 인터페이스 계약](../../contract/order-interface.md)
