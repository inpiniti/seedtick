# Admin Dashboard 도메인 명세서 (seedtick-admin)

> 미국 주식 자동 스크리닝·분석·매매 시스템의 통합 관제 및 제어 콘솔

## 1. 도메인 개요

`seedtick-admin`은 백그라운드에서 동작하는 `seedtick-analyzer`와 `seedtick-ai-gateway`의 실시간 상태를 모니터링하고, 수동 개입 및 비상 제어를 가능하게 하는 독립 웹 관리자 대시보드입니다.

## 2. 핵심 관제 지표 및 기능

| 구분 | 모니터링 및 제어 기능 | 연동 대상 |
| :--- | :--- | :--- |
| **인프라 관제** | • 서버 아웃바운드 공인 IP 확인 및 원클릭 복사<br>• 서버 헬스체크 (Healthy/Down) 및 환경(Dev/Prod)<br>• 미국 정규장(NYSE/NASDAQ) 개장/휴장 실시간 판별 | `seedtick-analyzer` (`/api/ip`, `/health`) |
| **자동매매 제어** | • 모의거래(Dry-Run) vs 실거래(Real) 상태 표시<br>• 당일 누적 투자금액 및 일일 한도(10만원) 소진율 게이지<br>• 금일 매수 체결 완료 종목 리스트<br>• 장외 시간 발주 차단 (정규장 개장 시간에만 그리드 자동매매) | `seedtick-analyzer` (`/api/auto-trading/*`, `/api/bridge/*`) |
| **파이프라인 제어** | • 12:00 KST 정기 배치 외 **수동 즉시 파이프라인 트리거** (`dry_run`, `force` 옵션)<br>• 실행 중에는 트리거 버튼 자동 **비활성화**<br>• **실시간 진행 패널**: 단계(스크리닝→데이터팩→가치드라이버→13인 요약→토론→최종 마스터), 종목 진행률(`3/21`), 13인 요약(`n/13`), 경과 시간, 최근 로그 표시 | `seedtick-analyzer` (`/api/scheduler/trigger`, `/api/scheduler/progress`) |
| **스크리너 & 거장 표결** | • 토스 13인 공통 필터 실시간 스크리닝 종목 조회<br>• **roma 탭**: DataRoma 슈퍼인베스터 10명 이상 공동 보유 종목 조회 (두번째 스크리너)<br>• 일자별 13인 거장 표결 점수 랭킹 매트릭스 (g0~g13) | Supabase `guru_votes`, Analyzer (`/api/screener/run`, `/api/screener/roma`) |
| **투자 보고서 뷰어** | • 종목별 5단계 심층 리포트 (데이터팩 + 13인 요약 + 원탁 토론 + 마스터 리포트) 마크다운 열람 | Supabase `guru_reports` |
| **일봉 & BB 차트** | • 실시간 스크리너 및 리포트 종목의 6개월 일봉 캔들스틱 + 볼린저 밴드(20, 2) 차트 열람<br>• 볼린저 밴드 위치 진단(상단 돌파, 상단 근접, 중심선, 하단 근접, 하단 이탈) 요약 배지 | `seedtick-analyzer` (`/api/screener/chart/{ticker}`) |
| **시스템 & 에러 로그** | • 실시간 이벤트/에러 로그 피드 (`INFO`, `WARNING`, `ERROR`, `CRITICAL`)<br>• 상세 에러 스택 및 JSON 컨텍스트 인스펙터 | Supabase `error_logs` |

## 3. 도메인 불변식 (Invariants)

1. **안전 제일 (Safety First)**: 실거래 모드 전환이나 수동 발주/파이프라인 트리거 시 반드시 2차 확인 모달 또는 슬라이더 형태의 안전 확인을 거친다.
2. **다크패턴 금지**: 모호한 버튼 문구 대신 명확한 동사형 라벨("주문 발주하기", "파이프라인 실행하기")을 사용하며, 취소는 언제나 명시적인 "닫기" 버튼을 제공한다.
3. **무중단 관제 (Graceful Degradation)**: `seedtick-analyzer` 서버가 일시적으로 오프라인 상태(Sleep/재부팅)여도, Supabase에 기록된 히스토리(리포트, 투표, 에러 로그)는 정상적으로 조회할 수 있어야 한다.
4. **UX 일관성 (Toss Design)**: 비주얼 토큰, 해요체 문구, 0.4초 내 도허티 피드백(스켈레톤), 피츠 터치 타깃 44px 이상을 준수한다.
