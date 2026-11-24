import { isReady, runCompletion, startHost, withKey, type StreamItem } from "./host"
import { chunk, completion, DONE, errorBody, toPrompt, type ChatRequest } from "./convert"

const port = Number(process.env.OPENCODE_SHIM_PORT ?? 4096)
const secret = process.env.OPENCODE_SHIM_SECRET ?? ""
const timeoutMs = Number(process.env.OPENCODE_SHIM_TIMEOUT_MS ?? 180_000)

await startHost()
console.log(`[opencode-shim] ready on 127.0.0.1:${port}`)

Bun.serve({
  hostname: "127.0.0.1",
  port,
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
    const bodyForModel = { ...body, model: body.model }
    let stream: AsyncGenerator<StreamItem>
    try {
      stream = await withKey(key, () =>
        runCompletion({ model: bodyForModel.model, prompt: toPrompt(body.messages), signal: controller.signal }),
      )
    } catch (error) {
      clearTimeout(timer)
      return Response.json(JSON.parse(errorBody(error instanceof Error ? error.message : String(error))), {
        status: 502,
      })
    }

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
        ctrl.enqueue(encoder.encode(chunk(body.model, { role: "assistant", content: "" })))
        try {
          for await (const item of stream) {
            if (item.type === "content") ctrl.enqueue(encoder.encode(chunk(body.model, { content: item.text })))
            else if (item.type === "reasoning")
              ctrl.enqueue(encoder.encode(chunk(body.model, { reasoning_content: item.text })))
            else if (item.type === "finish") {
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
          ctrl.enqueue(encoder.encode(chunk(body.model, {}, "stop")))
          ctrl.enqueue(encoder.encode(DONE))
          ctrl.close()
        } catch (error) {
          ctrl.enqueue(encoder.encode(chunk(body.model, {}, "stop")))
          ctrl.enqueue(encoder.encode(DONE))
          ctrl.close()
          console.error("[opencode-shim] stream error", error)
        } finally {
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
