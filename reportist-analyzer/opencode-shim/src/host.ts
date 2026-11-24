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
let chain: Promise<unknown> = Promise.resolve()
let listeners: Map<string, Listener> | null = null

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

export function setKey(key: string): void {
  currentKey = key
}

/** 직렬 실행: SDK의 전송 fetch가 프로세스 전역 키를 읽으므로 동시에 두 키를 쓸 수 없다. */
export function withKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    currentKey = key
    return fn()
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function runCompletion(input: {
  model: string
  prompt: string
  signal?: AbortSignal
}): Promise<AsyncGenerator<StreamItem>> {
  if (!host || !listeners) throw new Error("OpenCode host is not ready")
  const activeHost = host
  const activeListeners = listeners
  const sandbox = await mkdtemp(join(tmpdir(), "oc-shim-"))
  await writeFile(join(sandbox, "opencode.json"), JSON.stringify({ model: input.model }), "utf8")
  const modelID = input.model.replace(/^opencode\//, "")
  const session = await activeHost.sessions.create({
    location: { directory: sandbox },
    model: { id: modelID, providerID: "opencode" },
    permissions: DENY_ALL,
    title: "shim",
  })

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

  const cleanup = async () => {
    activeListeners.delete(session.id)
    await rm(sandbox, { recursive: true, force: true }).catch(() => undefined)
  }

  return (async function* () {
    try {
      let finished = false
      const deadline = Date.now() + 180_000
      while (!finished && Date.now() < deadline) {
        const item = await waitFor()
        if (!item) break
        if (item.type === "done") {
          finished = true
          break
        }
        if (item.type === "error") {
          yield item
          finished = true
          break
        }
        yield item
      }
      if (!finished) yield { type: "error", message: "generation timeout" }
    } finally {
      await cleanup()
    }
  })()
}
