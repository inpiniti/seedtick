# Git 컨벤션

## 브랜치 전략

- 기본 작업 방식: **`main`에서 직접 작업 후 푸시**(푸시 시 Vercel / Hugging Face Spaces 자동 배포 트리거).
- 실험적·대규모 변경일 때만 선택적으로 `feat/{name}`, `fix/{name}` 브랜치를 분리한다.

---

## 커밋 메시지 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### type
| type | 설명 |
|:---|:---|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 수정 |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 패키지, 설정 |
| `perf` | 성능 개선 |

### scope (프로젝트별)
**admin**: `admin`, `subscription`, `feedback`, `ui`
**ai-gateway**: `gateway`, `rotator`, `proxy`, `adapter`, `models`
**analyzer**: `screener`, `report`, `scheduler`, `error-log`
**apps**: `chat`, `game`, `video`

### 예시
```
feat(rotator): Gemini 키 로테이션에 에러 즉시 전환 추가

429 에러 발생 시 대기 없이 다음 키로 즉시 전환.
모든 키 소진 시 GATEWAY_ALL_KEYS_EXHAUSTED 에러 반환.

관련: #12
```

```
fix(report): 데이터팩 수집 실패 시 기본값 폴백 보정

Yahoo Finance 응답 누락 시 예외로 중단되던 문제 수정.
기본값 폴백 후 파이프라인 완주 보장.
```

---

## 커밋·배포 전 체크

- 수정한 서비스의 타입체크·테스트 통과 확인 (`.githooks/pre-commit` 자동 실행)
- `.env*` 및 시크릿 키 미포함 확인 필수
- `main` 푸시 시 프로덕션 자동 배포 + `.github/workflows/ci.yml` 검증 병렬 실행

---

## 버전 관리

- **semver** 사용: `MAJOR.MINOR.PATCH`
- 태그: `v1.0.0`
- MAJOR 증가: 계약(contract) 변경 (하위 호환 불가)
- MINOR 증가: 기능 추가 (하위 호환)
- PATCH 증가: 버그 수정
