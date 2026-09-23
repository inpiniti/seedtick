# Report 도메인 개요

## 역할

종목 티커(미국 주식)를 입력받아, 결정론적 데이터팩 빌더로 공용 심층 팩트를 수집하고, 13인의 투자 거장 페르소나 분석 → 원탁 토론 → 최종 종합 투자 보고서를 산출하며 Supabase DB에 동기화합니다.
(참고: `financial/.claude/skills/guru-report` 스펙 정본 준수)

## 5단계 파이프라인

```text
[티커]
  │
  ▼
[1단계] 공용 심층 데이터 팩 생성 (DataPackBuilder: Yahoo, SEC, Toss)
  │      └─ docs/report/{날짜}/_data/{티커}.md
  ▼
[2단계] 13인 개별 요약 블록 생성 (AI-Gateway 무료 티어 레이트리밋 방지용 순차 호출 & 딜레이)
  │      └─ docs/report/{날짜}/_data/{티커}_요약.md
  ▼
[3단계] 거장 원탁 토론 전문 생성 (핵심 쟁점 격돌 및 입장 표결)
  │      └─ docs/report/{날짜}/최종/{티커}_토론.md
  ▼
[4단계] 최종 종합 투자 보고서 생성 (Bull/Bear, 드라이버, 실전 가이드)
  │      └─ docs/report/{날짜}/최종/{티커}_최종보고서.md
  ▼
[5단계] Supabase DB 동기화 (guru_votes 테이블 기록) & 알림
```

## 산출물 디렉터리 구조

모든 산출물은 웹 앱 뷰어 및 사용자 확인을 위해 일자별 마크다운 파일로 보존됩니다:
```text
docs/report/{YYYY-MM-DD}/
├── _data/
│   ├── {티커}.md           # 1단계: 정량/정성 공용 데이터팩
│   └── {티커}_요약.md      # 2단계: 13인의 개별 요약 블록
└── 최종/
    ├── {티커}_토론.md      # 3단계: 거장 원탁 토론 전문
    └── {티커}_최종보고서.md # 4단계: 최종 마스터 종합 투자 보고서
```

## 13인의 거장 페르소나

| # | 페르소나 | 투자 철학 및 핵심 기준 |
|---|:---|:---|
| 1 | 워런 버핏 (Warren Buffett) | 경제적 해자, 높은 ROE, 훌륭한 비즈니스 적정가 매수 |
| 2 | 찰리 멍거 (Charlie Munger) | 역발상, 롤라팔루자 효과, 다학제적 격자틀 모델 |
| 3 | 피터 린치 (Peter Lynch) | PEG 비율, 6대 기업 분류, 아는 것에 투자 |
| 4 | 필립 피셔 (Philip Fisher) | 15개 스커틀벗 질문, 장기 성장 잠재력, R&D 역량 |
| 5 | 벤저민 그레이엄 (Benjamin Graham) | 절대적 안전마진, 순유동자산(NCAV), 저PER·저PBR |
| 6 | 세스 클라먼 (Seth Klarman) | 원금 보존 최우선, 절대 안전마진, 비유동성 할인 |
| 7 | 조엘 그린블라트 (Joel Greenblatt) | 마법공식 (높은 자본수익률 ROC + 높은 이익수익률 EY) |
| 8 | 존 템플턴 (John Templeton) | 극도의 비관론 시점 매수, 글로벌 바겐헌팅 |
| 9 | 앙드레 코스톨라니 (André Kostolany) | 코스톨라니의 달걀 모델, 시장 심리와 유동성 |
| 10 | 마이클 버리 (Michael Burry) | 재무제표 각주 검증, 비대칭 다운사이드 프로텍션 |
| 11 | 모니시 파브라이 (Mohnish Pabrai) | 단도 투자(Dhandho), 큰 업사이드 작은 다운사이드 |
| 12 | 잭 슈웨거 (Jack Schwager) | 추세추종, 손익비(Risk/Reward), 손절선 철저 준수 |
| 13 | 애스워스 다모다란 (Aswath Damodaran) | DCF 현금흐름할인, 스토리와 넘버의 결합, 내재가치 |

## 관련 문서

- [데이터 구조](./data-structures.md)
- [함수 명세](./functions.md)
- [테스트 케이스](./tests.md)
- [리포트 스키마](../../contract/report-schema.md)

