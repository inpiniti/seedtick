# 린트·타입체크·검증 설정 규칙

> 실제 설정의 단일 진실 원천(Single Source of Truth)은 각 서비스의 설정 파일(`eslint.config.mjs`, `biome.json`, `pyproject.toml`, `package.json`)입니다. 이 문서는 서비스별 실행 명령과 자동 게이트(Pre-commit · CI) 동작 기준을 정리합니다.

## 서비스별 검증 명령

| 서비스 | 린터 | 타입체크 | 테스트 | 설정 파일 |
| :--- | :--- | :--- | :--- | :--- |
| `reportist-admin` | `npx eslint <files>` | `npm run typecheck` (`tsc --noEmit`) | `npm test` (`vitest run`) | `reportist-admin/eslint.config.mjs` |
| `reportist-ai-gateway` | `bun run lint` (`biome check ./src ./tests`) | `bun run typecheck` (`tsc --noEmit`) | `bun test` | `reportist-ai-gateway/biome.json` |
| `reportist-analyzer` | `ruff check app/ tests/` | — | `pytest -q` | `reportist-analyzer/pyproject.toml` |
| `reportist-chat` | `npm run lint` (`oxlint`) | `npm run typecheck` (`tsc -b --noEmit`) | — | `reportist-chat/package.json` |
| `reportist-game` | — | `npm run typecheck` (`tsc -b --noEmit`) | — | `reportist-game/package.json` |
| `reportist-video` | — | `npm run typecheck` (`tsc -b --noEmit`) | — | `reportist-video/package.json` |

### 자동 포맷 / 수정 명령

- `reportist-ai-gateway`: `bun run lint:fix` / `bun run format`
- `reportist-analyzer`: `ruff check --fix app/ tests/` / `ruff format app/ tests/`

---

## 자동 게이트 정책 (Ratchet 방식)

기존 레거시 파일의 린트 부채가 신규 작업을 막지 않으면서, **새로 작성·수정되는 파일에는 슬롭이 유입되지 않도록** 변경 파일 기준 래칫(Ratchet) 정책을 적용합니다.

### 1. 로컬 Pre-commit 훅 (`.githooks/pre-commit`)

최초 클론 시 1회 활성화:

```bash
git config core.hooksPath .githooks
```

스테이징된 파일을 대상으로 자동 실행:
1. **시크릿·`.env` 차단**: `.env*`(예시 파일 제외), `.pem`/`.key`/`.p12` 파일 및 API 키 패턴(`AIzaSy`, `ghp_`, `hf_`, `sk-`, Private Key 헤더) 커밋 차단.
2. **변경된 서비스별 빠른 검증**:
   - `reportist-admin`: 스테이징 파일 ESLint + `npm run typecheck`
   - `reportist-ai-gateway`: 스테이징 파일 Biome check + `bun run typecheck`
   - `reportist-analyzer`: 스테이징 `.py` 파일 `python -m py_compile` + (설치 시) `ruff check`
   - `reportist-chat`: `npm run lint` (`oxlint`) + `npm run typecheck`
   - `reportist-game` / `reportist-video`: `npm run typecheck`

### 2. GitHub Actions CI (`.github/workflows/ci.yml`)

PR 및 `main`/`develop` 푸시 시 변경된 서비스만 골라 실행:
- 전체 타입체크 + 전체 단위 테스트(`vitest` / `bun test` / `pytest`)
- 변경 파일 린트(`eslint` / `biome` / `ruff` / `oxlint`)
