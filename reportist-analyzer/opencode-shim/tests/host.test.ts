import { describe, expect, test } from "bun:test"
import { DENY_TOOLS } from "../src/host"

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
