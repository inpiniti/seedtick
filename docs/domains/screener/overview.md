# Screener 도메인 개요

## 역할

미국 주식 시장에서 매일 분석할 종목 리스트를 자동 필터링합니다.

## 책임 범위

- 미국 주식 유니버스에서 조건을 만족하는 종목 추출
- 스크리닝 기준(거래량, 가격, 모멘텀 등) 적용
- 결과 리스트를 Report 도메인에 전달

## 책임 외 범위 (다른 도메인에 위임)

- 종목 분석/판단 → Report 도메인
- 데이터 저장 → infrastructure/supabase_client
- 스케줄 트리거 → Scheduler 도메인

## 외부 의존성

- **Yahoo Finance API** (yfinance 라이브러리): 종목 데이터 수집
- (향후) 추가 데이터 소스 가능

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
