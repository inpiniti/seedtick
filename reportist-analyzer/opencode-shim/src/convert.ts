export interface ChatMessage {
  role: string
  content: string | Array<{ type?: string; text?: string }>
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

const textOf = (content: ChatMessage["content"]): string =>
  typeof content === "string" ? content : content.map((part) => part.text ?? "").join("")

export function toPrompt(messages: ChatMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${textOf(message.content)}`)
    .join("\n\n")
}

let counter = 0
export function chunk(model: string, delta: Record<string, unknown>, finish: string | null = null): string {
  counter += 1
  const payload = {
    id: `chatcmpl-shim-${counter}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

export const DONE = "data: [DONE]\n\n"

export function completion(model: string, text: string, reasoning: string): string {
  return JSON.stringify({
    id: `chatcmpl-shim-${counter + 1}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text, ...(reasoning ? { reasoning_content: reasoning } : {}) },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  })
}

export function errorBody(message: string): string {
  return JSON.stringify({ error: { message, type: "server_error", code: "opencode_shim_error" } })
}
