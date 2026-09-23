# Screener 도메인 개요

## 역할

미국 주식 시장에서 13인의 거장 합의 기준(공통 필터)을 만족하는 우량 종목 리스트를 자동 스크리닝합니다.

## 핵심 필터 기준 (13인 거장 공통분모)

13인의 거장(버핏, 그레이엄, 클라먼, 파브라이, 그린블라트 등)이 공통으로 요구하는 안전성과 수익성 기본 마지노선:
- **시가총액**: 3,000억원 ($2.5억 이상)
- **부채비율 (TTM)**: 100% 이하
- **이자보상배율 (TTM)**: 3배 이상
- **영업이익률 (TTM)**: 10% 이상
- **ROE (TTM)**: 10% 이상

## 책임 범위

- 미국 주식(nation=us) 유니버스에서 거장 공통 필터를 통과한 종목 추출 (최대 200개)
- 티커 심볼 정규화 (토스 내부 코드 → 표준 티커 변환)
- 중복 및 제외 대상 필터링
- 스크리닝 통과 종목 리스트를 Report 도메인에 전달

## 외부 의존성
 
- **토스증권 비공개 WTS Screener API (직접 호출)**:
  - 세션 발급: `GET https://wts-api.tossinvest.com/api/v3/init` (XSRF-TOKEN 및 deviceId 쿠키)
  - 거장 공통 필터 조회: `POST https://wts-cert-api.tossinvest.com/api/v2/screener/screen`
  - 티커 심볼 보강: `GET https://wts-info-api.tossinvest.com/api/v2/stock-infos`

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
