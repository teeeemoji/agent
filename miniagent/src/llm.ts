import OpenAI from "openai"
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions"

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: "function"
    function: {
      name: string
      arguments: string
    }
  }>
}

export interface StreamResult {
  content: string
  toolCalls: Array<{
    id: string
    name: string
    arguments: string
  }>
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

function decodeUnicode(str: string): string {
  return str.replace(/\\u[\dA-Fa-f]{4}/g, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16))
  })
}

export async function streamChatWithTools(
  messages: ChatMessage[],
  tools?: ChatCompletionTool[]
): Promise<StreamResult> {
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
  const url = `${baseUrl}/chat/completions`

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  }

  if (tools && tools.length > 0) {
    body.tools = tools
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    },
    body: JSON.stringify(body),
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
  let fullContent = ""

  const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>()

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
      if (data === "[DONE]") break

      let parsed: unknown
      try {
        parsed = JSON.parse(data)
      } catch {
        process.stderr.write(`[警告] 无法解析 SSE chunk: ${data.slice(0, 80)}\n`)
        continue
      }

      const delta = (parsed as { choices?: Array<{ delta?: Record<string, unknown> }> })
        .choices?.[0]?.delta

      if (!delta) continue

      if (typeof delta.content === "string") {
        fullContent += delta.content
        process.stdout.write(delta.content as string)
      }

      const toolCalls = delta.tool_calls as Array<{
        index?: number
        id?: string
        function?: { name?: string; arguments?: string }
      }> | undefined

      if (toolCalls) {
        for (const tc of toolCalls) {
          const index = tc.index ?? 0
          let entry = toolCallMap.get(index)
          if (!entry) {
            entry = { id: "", name: "", arguments: "" }
            toolCallMap.set(index, entry)
          }
          if (tc.id) entry.id = tc.id
          if (tc.function?.name) entry.name += tc.function.name
          if (tc.function?.arguments) entry.arguments += tc.function.arguments
        }
      }
    }
  }

  const toolCalls = Array.from(toolCallMap.values()).map((tc) => ({
    ...tc,
    arguments: decodeUnicode(tc.arguments),
  }))

  if (toolCalls.length > 0) {
    process.stdout.write("\n")
  }

  return { content: fullContent, toolCalls }
}

export async function* streamChat(messages: ChatMessage[]): AsyncGenerator<string> {
  const result = await streamChatWithTools(messages)
  if (result.content) {
    yield result.content
  }
}
