---
name: handle-issue
description: 버그, 이상 현상, 기능 개선 요청이 인입되었을 때 이슈 유형(A 단순 UI / B 작은 버그 / C 복합 이슈)을 판단해 최소 절차로 구현·자가검증·커밋하는 차등 워크플로우
---

# handle-issue 워크플로우

운영 중 발견된 버그, 예외 상황, 기능 개선 요청을 **이슈 유형별 차등 절차**로 해결한다. 모든 유형에서 테스트·타입체크·린트 검증은 에이전트가 직접 실행하고 통과(Green)를 확인한다.

---

## 이슈 유형별 절차 요약

| 유형 | 판단 기준 | 수행 절차 |
| :--- | :--- | :--- |
| **A. 단순 UI 수정** | 레이아웃·스타일·카피·여백 등 비즈니스 로직 무관 변경 | 구현 → 자가 검증 → 커밋 |
| **B. 작은 버그** | 단일 에러, 조건 누락, 파싱/계산 오류, 훅·서비스 단순 수정 | TDD → 자가 검증 → 커밋 |
| **C. 복합 이슈** | 아키텍처·정책·신규 기능·동시성·스키마·계약 변경 | 인터뷰 → 도메인 명세 → UI/웹 점검(해당 시) → TDD → 코드리뷰 → 커밋 |

> 경계가 모호하면 더 단순한 유형을 선택한다.

---

## 참조 스킬 (해당 단계에서만 로드)

- **인터뷰**: `grilling`
- **웹/React UI 품질·카피**: `toss-design`, `vercel-react-best-practices`
- **TDD**: `tdd`
- **코드 리뷰**: `code-review`

---

## 단계 1: 이슈 분석 및 유형 판단

변경 전 아래 세 항목을 한 줄씩 정리하고 유형(A/B/C)을 확정한다.

- **증상**: 사용자가 보고한 현상 또는 요청
- **근본 원인 후보 / 대상 서비스**: 예) `reportist-admin`, `reportist-ai-gateway`, `reportist-analyzer`, `reportist-chat` 등
- **영향 범위**: API 계약, DB/RLS, 스케줄러 파이프라인, UI 상태 영향 여부

---

## 유형 A: 단순 UI 수정

1. 한국어 UI/카피 변경 시 `toss-design` 기준에 맞춰 수정한다.
2. 수정한 서비스의 타입체크 및 변경 파일 린트를 직접 실행해 통과를 확인한다(`AGENTS.md` 검증 표 참조).
3. 한글 Conventional Commit으로 커밋한다(예: `fix(admin): 종목 상세 헤더 여백 조정`).

---

## 유형 B: 작은 버그

1. `tdd` 스킬을 로드해 **Red → Green → Refactor** 순서로 수정한다.
   - **Red**: 버그를 재현하는 단위 테스트를 먼저 작성하고 실패를 직접 확인한다.
   - **Green**: 최소 수정으로 테스트 통과를 직접 확인한다.
2. **자가 검증(직접 실행)**: 수정한 서비스의 테스트·타입체크·변경 파일 린트를 모두 실행하고 통과를 확인한다.
   - `reportist-admin`: `npm run typecheck && npm test && npx eslint <변경파일>`
   - `reportist-ai-gateway`: `bun run typecheck && bun test && npx biome check <변경파일>`
   - `reportist-analyzer`: `pytest -q` (+ `ruff check <변경파일>`)
   - `reportist-chat` / `game` / `video`: `npm run typecheck` (+ `npm run lint`)
3. 한글 Conventional Commit으로 커밋한다(예: `fix(report): 데이터팩 누락 시 기본값 폴백 보정`).

---

## 유형 C: 복합 이슈

### C-1: 도메인 매핑 및 인터뷰 (`grilling`)

1. `docs/domain/` 또는 `docs/domains/`에서 책임 도메인을 식별한다(신규 도메인이면 `add-domain`으로 먼저 등록).
2. `grilling` 지침에 따라 숨은 엣지 케이스·정책 결정을 사용자와 합의한다.

### C-2: 도메인 명세 업데이트

합의된 요구사항과 불변식을 해당 도메인 문서(`README.md`, `feature.md`, 필요 시 `architecture.md`) 및 `docs/contract/`에 반영한다.

### C-3: UI / React 점검 (프론트엔드 변경 시에만)

수정 범위에 React 컴포넌트·상태·렌더링이 포함되면 `toss-design` 및 `vercel-react-best-practices` 기준으로 점검한다(로딩/빈/에러 상태, 불필요한 리렌더링, 워터폴 fetch, 접근성/카피). 비-UI 작업이면 사유를 한 줄 적고 건너뛴다.

### C-4: TDD 구현 및 자가 검증

`tdd` 지침에 따라 Red → Green → Refactor를 수행하고, 해당 서비스의 전체 테스트·타입체크·변경 파일 린트를 **에이전트가 직접 실행해 모두 통과**시킨다.

### C-5: 코드 리뷰 (`code-review`)

`code-review` 지침에 따라 두 축을 자체 점검한다.
- **Standards 축**: `docs/rules/coding-standards.md`, `docs/rules/safety-rules.md` 준수 여부
- **Spec 축**: 도메인 문서·합의 요구사항과 실제 diff 일치 여부

### C-6: 커밋

문서와 코드를 논리적 단위로 한글 Conventional Commit한다(예: `feat(subscription): 체험 만료 안내 배너 및 정책 추가`).

---

## 완료 보고

- 판단한 이슈 유형(A/B/C)과 수행 단계 요약
- 직접 실행한 검증 명령어와 결과(테스트 수, 타입체크, 린트 결과)
- (유형 C) 갱신된 도메인 문서 및 리뷰 발견 사항
- 생성된 커밋 해시(커밋 수행 시)
