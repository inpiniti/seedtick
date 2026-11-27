import { isReady, runCompletion, startHost, type StreamItem } from "./host"
import { chunk, completion, DONE, errorBody, extractPromptFiles, toPrompt, type ChatRequest } from "./convert"
import { SHIM_IDLE_TIMEOUT, SSE_HEARTBEAT_MS, startSseHeartbeat } from "./sse"

const port = Number(process.env.OPENCODE_SHIM_PORT ?? 4096)
const secret = process.env.OPENCODE_SHIM_SECRET ?? ""
const timeoutMs = Number(process.env.OPENCODE_SHIM_TIMEOUT_MS ?? 180_000)

await startHost()
console.log(`[opencode-shim] ready on 127.0.0.1:${port}`)

Bun.serve({
  hostname: "127.0.0.1",
  port,
  idleTimeout: SHIM_IDLE_TIMEOUT,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", ready: isReady() })
    }
    if (url.pathname !== "/v1/chat/completions") {
      return new Response("Not Found", { status: 404 })
    }
    if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json(JSON.parse(errorBody("unauthorized")), { status: 401 })
    }
    const key = request.headers.get("x-opencode-api-key")?.trim()
    if (!key) {
      return Response.json(JSON.parse(errorBody("missing x-opencode-api-key")), { status: 400 })
    }

    let body: ChatRequest
    try {
      body = (await request.json()) as ChatRequest
    } catch {
      return Response.json(JSON.parse(errorBody("invalid json")), { status: 400 })
    }
    if (!body.model?.startsWith("opencode/") || !Array.isArray(body.messages)) {
      return Response.json(JSON.parse(errorBody("model must start with opencode/ and messages required")), {
        status: 400,
      })
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const stream: AsyncGenerator<StreamItem> = runCompletion({
      model: body.model,
      prompt: toPrompt(body.messages),
      files: extractPromptFiles(body.messages),
      key,
      signal: controller.signal,
    })

    if (!body.stream) {
      let text = ""
      let reasoning = ""
      let failure: string | null = null
      try {
        for await (const item of stream) {
          if (item.type === "content") text += item.text
          else if (item.type === "reasoning") reasoning += item.text
          else if (item.type === "error") failure = item.message
        }
      } finally {
        clearTimeout(timer)
      }
      if (failure) return Response.json(JSON.parse(errorBody(failure)), { status: 502 })
      return new Response(completion(body.model, text, reasoning), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      })
    }

    const encoder = new TextEncoder()
    const sse = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        // 첫 청크를 정상 role 청크로 보내면 게이트웨이가 에러를 못 잡고 키를 바꾸지 않는다.
        // 실제 토큰이 올 때까지 role 청크를 미뤄, 에러가 먼저 오면 첫 청크가 에러가 되게 한다.
        // 콜드 스타트/락 대기 중에는 실제 청크가 없으므로 SSE 주석으로 연결을 유지한다.
        const stopHeartbeat = startSseHeartbeat((ping) => {
          try {
            ctrl.enqueue(ping)
          } catch {
            // 소비자가 이미 끊어진 경우 무시한다.
          }
        }, SSE_HEARTBEAT_MS)
        let sentRole = false
        const ensureRole = () => {
          if (sentRole) return
          sentRole = true
          ctrl.enqueue(encoder.encode(chunk(body.model, { role: "assistant", content: "" })))
        }
        try {
          for await (const item of stream) {
            if (item.type === "content") {
              ensureRole()
              ctrl.enqueue(encoder.encode(chunk(body.model, { content: item.text })))
            } else if (item.type === "reasoning") {
              ensureRole()
              ctrl.enqueue(encoder.encode(chunk(body.model, { reasoning_content: item.text })))
            } else if (item.type === "finish") {
              // terminating chunk is emitted after [DONE] handling below
            } else if (item.type === "error") {
              ctrl.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: { message: item.message, type: "server_error" } })}\n\n`,
                ),
              )
              ctrl.enqueue(encoder.encode(DONE))
              ctrl.close()
              return
            }
          }
          ensureRole()
          ctrl.enqueue(encoder.encode(chunk(body.model, {}, "stop")))
          ctrl.enqueue(encoder.encode(DONE))
          ctrl.close()
        } catch (error) {
          ctrl.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: { message: String(error), type: "server_error" } })}\n\n`),
          )
          ctrl.enqueue(encoder.encode(DONE))
          ctrl.close()
          console.error("[opencode-shim] stream error", error)
        } finally {
          stopHeartbeat()
          clearTimeout(timer)
        }
      },
    })
    return new Response(sse, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  },
})
