import { describe, expect, test } from "bun:test"
import { SHIM_IDLE_TIMEOUT, SSE_HEARTBEAT_MS, startSseHeartbeat } from "../src/sse"

describe("OpenCode shim SSE keepalive", () => {
  test("Bun.serve idle timeout을 비활성화해 콜드 스타트 중 연결이 끊기지 않는다", () => {
    expect(SHIM_IDLE_TIMEOUT).toBe(0)
    expect(SSE_HEARTBEAT_MS).toBeGreaterThan(0)
  })

  test("하트비트는 data:가 아닌 SSE 주석만 보낸다", async () => {
    const chunks: string[] = []
    const stop = startSseHeartbeat(
      (chunk) => chunks.push(new TextDecoder().decode(chunk)),
      20,
    )
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 70))
    stop()

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.every((chunk) => chunk === ": ping\n\n")).toBe(true)
  })

  test("stop 후에는 더 이상 보내지 않는다", async () => {
    const chunks: string[] = []
    const stop = startSseHeartbeat(
      (chunk) => chunks.push(new TextDecoder().decode(chunk)),
      20,
    )
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 50))
    stop()
    const count = chunks.length
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 50))

    expect(chunks.length).toBe(count)
  })
})
