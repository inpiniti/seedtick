import { describe, expect, test } from "bun:test"
import { chunk, completion, DONE, errorBody, extractPromptFiles, toPrompt } from "../src/convert"

describe("convert", () => {
  test("messages를 role 표기 프롬프트로 직렬화한다", () => {
    expect(
      toPrompt([
        { role: "system", content: "Be brief" },
        { role: "user", content: "Hi" },
      ])
    ).toBe("SYSTEM: Be brief\n\nUSER: Hi")
  })

  test("content part 배열을 텍스트로 평탄화한다", () => {
    expect(toPrompt([{ role: "user", content: [{ type: "text", text: "A" }, { type: "text", text: "B" }] }])).toBe(
      "USER: AB"
    )
  })

  test("SSE 청과 종료 마커를 만든다", () => {
    const data = chunk("opencode/hy4-flash-free", { content: "PONG" })
    expect(data.startsWith("data: ")).toBe(true)
    expect(data.endsWith("\n\n")).toBe(true)
    expect(JSON.parse(data.slice(6)).choices[0].delta.content).toBe("PONG")
    expect(DONE).toBe("data: [DONE]\n\n")
  })

  test("완성 응답에 reasoning_content를 포함한다", () => {
    const parsed = JSON.parse(completion("m", "PONG", "thinking"))
    expect(parsed.choices[0].message).toEqual({ role: "assistant", content: "PONG", reasoning_content: "thinking" })
  })

  test("에러 본문을 OpenAI 형식으로 만든다", () => {
    expect(JSON.parse(errorBody("boom")).error.message).toBe("boom")
  })

  test("image_url 데이터 URI를 SDK 첨부파일로 변환한다", () => {
    const files = extractPromptFiles([
      {
        role: "user",
        content: [
          { type: "text", text: "이 프레임을 설명해줘" },
          { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } },
        ],
      },
      { role: "user", content: [{ type: "image_url", image_url: { url: "https://example.com/a.png" } }] },
    ])

    expect(files).toHaveLength(1)
    expect(files[0].uri).toBe("data:image/png;base64,iVBORw0KGgo=")
    expect(files[0].source).toEqual({ type: "inline" })
  })
})
