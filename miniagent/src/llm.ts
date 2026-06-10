import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  tool_call_id?: string
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
})

const model = process.env.OPENAI_MODEL ?? "gpt-4o"

export async function chat(messages: ChatMessage[]): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: messages as ChatCompletionMessageParam[],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error("LLM 返回了空响应")
  }

  return content
}

export async function* streamChat(messages: ChatMessage[]): AsyncGenerator<string> {
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  const url = `${baseUrl}/chat/completions`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    throw new Error(`LLM API 错误: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("无法获取响应流")
  }

  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith("data: ")) continue

      const data = trimmed.slice(6)
      if (data === "[DONE]") return

      let parsed: unknown
      try {
        parsed = JSON.parse(data)
      } catch {
        process.stderr.write(`[警告] 无法解析 SSE chunk: ${data.slice(0, 80)}\n`)
        continue
      }

      const content = (parsed as { choices?: Array<{ delta?: { content?: string | null } }> })
        .choices?.[0]?.delta?.content
      if (content) {
        yield content
      }
    }
  }
}
