# 린트 설정 규칙

## seedtick-ai-gateway — Biome

### biome.json
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "style": {
        "noNonNullAssertion": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "asNeeded"
    }
  }
}
```

### tsconfig.json (핵심 설정)
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### package.json scripts
```json
{
  "scripts": {
    "lint": "biome lint ./src",
    "format": "biome format --write ./src",
    "check": "biome check ./src",
    "type-check": "tsc --noEmit"
  }
}
```

---

## seedtick-analyzer — Ruff

### pyproject.toml
```toml
[tool.ruff]
target-version = "py312"
line-length = 100
select = [
  "E",   # pycodestyle errors
  "W",   # pycodestyle warnings
  "F",   # pyflakes
  "I",   # isort
  "B",   # flake8-bugbear
  "C4",  # flake8-comprehensions
  "UP",  # pyupgrade
]
ignore = [
  "E501",  # line too long (100으로 완화)
]

[tool.ruff.isort]
known-first-party = ["app"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"

[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = true
```

### Makefile
```makefile
lint:
    ruff check app/ tests/

format:
    ruff format app/ tests/

type-check:
    mypy app/

test:
    pytest tests/ -v

check: lint type-check test
```

---

## 공통 규칙

### 커밋 전 자동 검사 (pre-commit hook 권장)

**ai-gateway** (package.json)
```json
{
  "scripts": {
    "pre-commit": "bun run check && bun run type-check"
  }
}
```

**analyzer** (Makefile)
```makefile
pre-commit: lint type-check
```
