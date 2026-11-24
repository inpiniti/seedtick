import { mkdtemp, writeFile } from "node:fs/promises"
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
let sandbox: string | null = null
let listeners: Map<string, Listener> | null = null

// action "*" 로 전부 거부하면 SDK의 내부 권한 체크(무인 자동 허용 포함)까지 막혀
// 프로바이더가 익명 free 경로로 떨어지고 FreeUsageLimitError(429)가 난다.
// 실제 도구 action만 명시적으로 거부해 도구 실행은 막되 인증 경로는 보존한다.
const DENY_TOOL_ACTIONS = [
  "shell",
  "edit",
  "write",
  "read",
  "grep",
  "glob",
  "webfetch",
  "websearch",
  "task",
  "subagent",
  "question",
  "skill",
  "external_directory",
  "todo",
] as const
export const DENY_TOOLS = DENY_TOOL_ACTIONS.map((action) => ({
  action,
  resource: "*",
  effect: "deny" as const,
}))

// SDK는 요청을 보낼 때 process.env.OPENCODE_API_KEY 를 읽는다(생성 시점이 아님).
// 따라서 fetch 로 Authorization 헤더를 덮어쓸 필요 없이 락 안에서 키만 교체한다.
let previousKey: string | undefined

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

export async function startHost(): Promise<void> {
  // 요청마다 mkdtemp 하면 새 Location 인스턴스가 계속 메모리에 캐시된다.
  // 샌드박스를 한 번만 만들어 재사용해 초기화 지연과 누수를 제거한다.
  sandbox = await mkdtemp(join(tmpdir(), "oc-shim-"))
  await writeFile(join(sandbox, "opencode.json"), JSON.stringify({ model: "opencode/hy4-flash-free" }), "utf8")

  const opencode = await OpenCode.create({
    app: { name: "opencode", version: "2.4.1", channel: "latest" },
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
  return host !== null && listeners !== null && sandbox !== null
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
  previousKey = process.env.OPENCODE_API_KEY
  process.env.OPENCODE_API_KEY = input.key
  let sessionID: string | null = null
  try {
    if (!host || !listeners || !sandbox) throw new Error("OpenCode host is not ready")
    const activeHost = host
    const activeListeners = listeners
    const modelID = input.model.replace(/^opencode\//, "")
    const session = await activeHost.sessions.create({
      location: { directory: sandbox },
      model: { id: modelID, providerID: "opencode" },
      permissions: DENY_TOOLS,
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
    if (previousKey === undefined) delete process.env.OPENCODE_API_KEY
    else process.env.OPENCODE_API_KEY = previousKey
    unlock()
  }
}
