import { afterEach, describe, expect, test } from "bun:test"
import { applyOpenCodeApiKeyEnv, DENY_TOOLS } from "../src/host"

const rules: ReadonlyArray<{ action: string; resource: string; effect: string }> = DENY_TOOLS

describe("host permissions", () => {
  test("와일드카드 전체 거부가 없어 내부 인증 체크를 막지 않는다", () => {
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.some((rule) => rule.action === "*")).toBe(false)
    expect(rules.every((rule) => rule.effect === "deny")).toBe(true)
  })

  test("실제 도구 action만 명시적으로 거부한다", () => {
    const actions: string[] = rules.map((rule) => rule.action)
    for (const action of ["shell", "edit", "write", "read", "grep", "glob", "webfetch"]) {
      expect(actions).toContain(action)
    }
  })
})

describe("applyOpenCodeApiKeyEnv", () => {
  const originalKey = process.env.OPENCODE_API_KEY

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENCODE_API_KEY
    else process.env.OPENCODE_API_KEY = originalKey
  })

  test("public 또는 빈 키는 OPENCODE_API_KEY를 제거해 무키(Bearer public) 경로를 탄다", () => {
    process.env.OPENCODE_API_KEY = "oc_sk_existing"
    applyOpenCodeApiKeyEnv("public")
    expect(process.env.OPENCODE_API_KEY).toBeUndefined()

    process.env.OPENCODE_API_KEY = "oc_sk_existing"
    applyOpenCodeApiKeyEnv("   ")
    expect(process.env.OPENCODE_API_KEY).toBeUndefined()
  })

  test("일반 키는 trim 후 OPENCODE_API_KEY에 설정한다", () => {
    applyOpenCodeApiKeyEnv(" oc_sk_test123 ")
    expect(process.env.OPENCODE_API_KEY).toBe("oc_sk_test123")
  })
})
