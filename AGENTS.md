# Seedtick Monorepo — Agent Guide

Multi-service monorepo for US stock screening, 13-guru investment reports, LLM gateway, and web apps.

## Services & Verification Commands

After modifying code in any service, run its verification commands yourself and confirm passing output before reporting done.

| Folder | Stack | Verify Commands (run inside folder) |
| :--- | :--- | :--- |
| `reportist-admin/` | Next.js 16, React 19, TS, Vitest | `npm run typecheck && npm test` (+ `npx eslint <changed-files>`) |
| `reportist-ai-gateway/` | Bun, Elysia, TS, Biome | `bun run typecheck && bun test` (+ `npx biome check <changed-files>`) |
| `reportist-analyzer/` | Python 3.11+, FastAPI, pytest, Ruff | `pytest -q` (+ `ruff check <changed-files>`) |
| `reportist-chat/` | Vite, React 19, TS, oxlint | `npm run lint && npm run typecheck` |
| `reportist-game/` | Vite, React 19, TS | `npm run typecheck` |
| `reportist-video/` | Vite, React 19, TS | `npm run typecheck` |
| `promo-penguincut/` | HyperFrames | Read `promo-penguincut/AGENTS.md`; run `npm run check` |

## Self-Verification Loop

- Run tests, typechecks, and linters directly in the shell — never ask the user to run them on your behalf.
- Fix failures introduced by your changes until all checks pass. If a pre-existing failure is unrelated, report it verbatim with file and error details.
- Local commits run `.githooks/pre-commit` (secret guard + staged lint/typecheck). Enable once per clone with `git config core.hooksPath .githooks`.

## Worktree & Finish Workflow (Default)

- New threads run in isolated git worktrees (T3 Code creates one automatically and links `node_modules` / `.env*` via `scripts/worktree-setup.ps1`). If `node_modules` is missing in a worktree, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/worktree-setup.ps1`.
- After verifying and committing changes in a worktree, immediately merge to `main`, push, and delete the finished worktree:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/worktree-finish.ps1
  ```
- If `worktree-finish.ps1` reports a rebase conflict with `main`, run `git rebase main`, resolve conflicts, re-run verification checks, then re-run `worktree-finish.ps1`.
- Keep the primary `main` checkout clean so parallel worktrees can fast-forward merge into `main` without blocking.

## Hard Guardrails

- **Analysis & screening only**: Keep broker integrations, order execution, and trading logic out of the codebase (`docs/rules/safety-rules.md`).
- **Secrets**: Keep `.env*` files, API keys, and private keys out of git commits and client bundles; use environment variables only.
- **Production branch (`main`)**: Pushing `main` auto-deploys to Vercel and Hugging Face Spaces. Always finish self-verification before committing and running `scripts/worktree-finish.ps1`, using Korean Conventional Commits (`docs/rules/git-convention.md`).

## Context Pointers (Read On Demand)

- **System architecture / data pipeline** → `docs/architecture/overview.md`
- **TS / Python coding standards** → `docs/rules/coding-standards.md`
- **Linter / typecheck / CI setup** → `docs/rules/lint-config.md`
- **Issue triage (UI / bug / complex change)** → `.agents/skills/handle-issue/SKILL.md`
- **Korean UI / UX copy & layout** → `.agents/skills/toss-design/SKILL.md`
- **Security / Supabase RLS / auth audit** → `.agents/skills/security-audit/SKILL.md`
- **Sub-project overrides** → read `reportist-admin/AGENTS.md` (Next.js 16 docs notice) or `promo-penguincut/AGENTS.md` when editing inside those folders.
