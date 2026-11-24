import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { OpenCode } from "@opencode/sdk"

export type StreamItem =
  | { type: "content"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "finish"; finish: string }
  | { type: "done" }
  | { type: "error"; message: string }

type Listener = (item: StreamItem) => void

type Host = Awaited<ReturnType<typeof OpenCode.create>>
let host: Host | null = null

const DENY_ALL = [{ action: "*", resource: "*", effect: "deny" as const }]
const nativeFetch = globalThis.fetch
let currentKey = process.env.OPENCODE_API_KEY ?? ""
let listeners: Map<string, Listener> | null = null

// SDK의 전송 fetch가 프로세스 전역 키를 읽으므로, 실제 모델 호출이 끝날 때까지 키를 점유한다.
let locked = false
const waiters: Array<() => void> = []

async function acquire(): Promise<() => void> {
  if (!locked) {
    locked = true
    return release
  }
  await new Promise<void>((resolve) => waiters.push(resolve))
  return release
}

function release(): void {
  const next = waiters.shift()
  if (next) next()
  else locked = false
}

const fetchWithKey = ((input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init)
  if (!currentKey || !request.url.includes("opencode.ai/")) return nativeFetch(request)
  const headers = new Headers(request.headers)
  headers.set("Authorization", `Bearer ${currentKey}`)
  return nativeFetch(new Request(request, { headers }))
}) as typeof fetch

export async function startHost(): Promise<void> {
  const opencode = await OpenCode.create({
    fetch: fetchWithKey,
    config: { content: JSON.stringify({ model: "opencode/hy4-flash-free" }) },
  })
  const active = new Map<string, Listener>()
  listeners = active
  void (async () => {
    for await (const event of opencode.events.subscribe()) {
      const data = (event as { data?: Record<string, unknown> }).data
      const sessionID = data?.sessionID
      if (typeof sessionID !== "string") continue
      const listener = active.get(sessionID)
      if (!listener) continue
      switch (event.type) {
        case "session.text.delta":
          listener({ type: "content", text: String(data?.delta ?? "") })
          break
        case "session.reasoning.delta":
          listener({ type: "reasoning", text: String(data?.delta ?? "") })
          break
        case "session.step.ended":
          listener({ type: "finish", finish: String(data?.finish ?? "stop") })
          break
        case "session.execution.succeeded":
          listener({ type: "done" })
          break
        case "session.execution.failed":
          listener({ type: "error", message: JSON.stringify(data).slice(0, 500) })
          break
      }
    }
  })()
  host = opencode
}

export function isReady(): boolean {
  return host !== null && listeners !== null
}

/**
 * 요청마다 전달된 키로 세션 생성~응답 완료 전체를 직렬 실행한다.
 * (sessions.prompt는 admission에서 반환되므로, 그 이후에 일어나는 실제 추론 호출까지 잡아야 한다.)
 */
export async function* runCompletion(input: {
  model: string
  prompt: string
  key: string
  signal?: AbortSignal
}): AsyncGenerator<StreamItem> {
  const unlock = await acquire()
  currentKey = input.key
  let sessionID: string | null = null
  let sandbox: string | null = null
  try {
    if (!host || !listeners) throw new Error("OpenCode host is not ready")
    const activeHost = host
    const activeListeners = listeners
    sandbox = await mkdtemp(join(tmpdir(), "oc-shim-"))
    await writeFile(join(sandbox, "opencode.json"), JSON.stringify({ model: input.model }), "utf8")
    const modelID = input.model.replace(/^opencode\//, "")
    const session = await activeHost.sessions.create({
      location: { directory: sandbox },
      model: { id: modelID, providerID: "opencode" },
      permissions: DENY_ALL,
      title: "shim",
    })
    sessionID = session.id

    const queue: StreamItem[] = []
    let wake: (() => void) | null = null
    const push = (item: StreamItem) => {
      queue.push(item)
      wake?.()
      wake = null
    }
    activeListeners.set(session.id, push)

    const waitFor = (): Promise<StreamItem | undefined> =>
      new Promise((resolve) => {
        if (queue.length > 0) return resolve(queue.shift())
        wake = () => resolve(queue.shift())
        if (input.signal) {
          input.signal.addEventListener("abort", () => resolve({ type: "error", message: "aborted" }), { once: true })
        }
      })

    await activeHost.sessions.prompt({ sessionID: session.id, text: input.prompt })

    let finished = false
    const deadline = Date.now() + 180_000
    while (!finished && Date.now() < deadline) {
      const item = await waitFor()
      if (!item) break
      if (item.type === "done") {
        finished = true
        break
      }
      yield item
      if (item.type === "error") {
        finished = true
        break
      }
    }
    if (!finished) yield { type: "error", message: "generation timeout" }
  } catch (error) {
    yield { type: "error", message: error instanceof Error ? error.message : String(error) }
  } finally {
    if (sessionID && listeners) listeners.delete(sessionID)
    if (sandbox) await rm(sandbox, { recursive: true, force: true }).catch(() => undefined)
    unlock()
  }
}
