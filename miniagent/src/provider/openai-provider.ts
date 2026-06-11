import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import type { ChatMessage, IProvider, ModelInfo, StreamResult } from "./types.js"

export interface OpenAIConfig {
  apiKey: string
  baseURL: string
  model: string
}

function decodeUnicode(str: string): string {
  return str.replace(/\\u[\dA-Fa-f]{4}/g, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16))
  })
}

export class OpenAIProvider implements IProvider {
  private client: OpenAI
  private model: string
  private apiKey: string
  private baseURL: string

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL
    this.model = config.model
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
    })
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as ChatCompletionMessageParam[],
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("[API 错误] LLM 返回了空响应")
    }

    return content
  }

  async streamChat(
    messages: ChatMessage[],
    tools?: unknown[]
  ): Promise<StreamResult> {
    const url = `${this.baseURL}/chat/completions`

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: true,
    }

    if (tools && tools.length > 0) {
      body.tools = tools
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`[网络错误] 请求失败: ${message}`)
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(`[速率限制] API 返回 429，请稍后重试`)
      }
      const errorBody = await response.text().catch(() => "")
      throw new Error(
        `[API 错误] ${response.status} ${response.statusText}${errorBody ? `: ${errorBody.slice(0, 500)}` : ""}`
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("[网络错误] 无法获取响应流")
    }

    const decoder = new TextDecoder("utf-8")
    let buffer = ""
    let fullContent = ""

    const toolCallMap = new Map<
      number,
      { id: string; name: string; arguments: string }
    >()

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
          process.stderr.write(
            `[警告] 无法解析 SSE chunk: ${data.slice(0, 80)}\n`
          )
          continue
        }

        const delta = (
          parsed as {
            choices?: Array<{ delta?: Record<string, unknown> }>
          }
        ).choices?.[0]?.delta

        if (!delta) continue

        if (typeof delta.content === "string") {
          fullContent += delta.content
          process.stdout.write(delta.content as string)
        }

        const toolCalls = delta.tool_calls as
          | Array<{
              index?: number
              id?: string
              function?: { name?: string; arguments?: string }
            }>
          | undefined

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

  listModels(): ModelInfo[] {
    return [{ id: this.model, name: this.model }]
  }
}
