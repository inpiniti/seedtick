# Git 컨벤션

## 브랜치 전략

```
main          프로덕션 배포본 (자동 배포 트리거)
develop       통합 개발 브랜치
feat/{name}   새 기능
fix/{name}    버그 수정
docs/{name}   문서 수정
chore/{name}  설정, 패키지 관리
```

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
**ai-gateway**: `gateway`, `rotator`, `proxy`, `adapter`
**analyzer**: `screener`, `report`, `scheduler`, `trading`, `bridge`, `error-log`

### 예시
```
feat(rotator): Gemini 키 로테이션에 에러 즉시 전환 추가

429 에러 발생 시 대기 없이 다음 키로 즉시 전환.
모든 키 소진 시 GATEWAY_ALL_KEYS_EXHAUSTED 에러 반환.

관련: #12
```

```
fix(trading): 당일 중복 주문 방지 조건 누락 수정

is_already_ordered() 체크가 paper-trading 모드에서만
동작하던 버그 수정. 실거래 모드에서도 항상 검사하도록.
```

---

## PR 규칙

- 최소 셀프 리뷰 후 머지
- main 직접 push 금지
- 배포 전 PAPER_TRADING_MODE 환경변수 확인 필수

---

## 버전 관리

- **semver** 사용: `MAJOR.MINOR.PATCH`
- 태그: `v1.0.0`
- MAJOR 증가: 계약(contract) 변경 (하위 호환 불가)
- MINOR 증가: 기능 추가 (하위 호환)
- PATCH 증가: 버그 수정
