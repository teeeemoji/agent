import type {
  ChatMessage,
  IProvider,
  ModelInfo,
  StreamResult,
  AssistantToolCall,
} from "./types.js"

interface AnthropicConfig {
  apiKey: string
  model: string
  baseURL?: string
}

interface AnthropicTextContent {
  type: "text"
  text: string
}

interface AnthropicToolUseContent {
  type: "tool_use"
  id: string
  name: string
  input: Record<string, unknown>
}

interface AnthropicToolResultContent {
  type: "tool_result"
  tool_use_id: string
  content: string
}

type AnthropicContentBlock =
  | AnthropicTextContent
  | AnthropicToolUseContent
  | AnthropicToolResultContent

interface AnthropicMessage {
  role: "user" | "assistant"
  content: string | AnthropicContentBlock[]
}

interface AnthropicTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

function convertMessagesToAnthropic(messages: ChatMessage[]): {
  systemPrompt: string
  messages: AnthropicMessage[]
} {
  let systemPrompt = ""
  const converted: AnthropicMessage[] = []

  for (const msg of messages) {
    if (msg.role === "system") {
      systemPrompt += (systemPrompt ? "\n" : "") + (msg.content ?? "")
      continue
    }

    if (msg.role === "user") {
      converted.push({ role: "user", content: msg.content ?? "" })
      continue
    }

    if (msg.role === "assistant") {
      const blocks: AnthropicContentBlock[] = []

      if (msg.content) {
        blocks.push({ type: "text", text: msg.content })
      }

      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          let parsedInput: Record<string, unknown> = {}
          try {
            parsedInput = JSON.parse(tc.function.arguments)
          } catch {
            parsedInput = { _raw: tc.function.arguments }
          }
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: parsedInput,
          })
        }
      }

      converted.push({ role: "assistant", content: blocks })
      continue
    }

    if (msg.role === "tool") {
      converted.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id ?? "unknown",
            content: typeof msg.content === "string" ? msg.content : "",
          },
        ],
      })
    }
  }

  return { systemPrompt, messages: converted }
}

function convertOpenAIToolsToAnthropic(
  tools: unknown[]
): AnthropicTool[] {
  return tools.map((tool) => {
    const t = tool as {
      type: string
      function: {
        name: string
        description: string
        parameters: Record<string, unknown>
      }
    }
    return {
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }
  })
}

function decodeUnicode(str: string): string {
  return str.replace(/\\u[\dA-Fa-f]{4}/g, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16))
  })
}

export class AnthropicProvider implements IProvider {
  private apiKey: string
  private model: string
  private baseURL: string

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey
    this.model = config.model
    this.baseURL = config.baseURL ?? "https://api.anthropic.com/v1"
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const { systemPrompt, messages: anthropicMessages } =
      convertMessagesToAnthropic(messages)

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      messages: anthropicMessages,
    }

    if (systemPrompt) {
      body.system = systemPrompt
    }

    let response: Response
    try {
      response = await fetch(`${this.baseURL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
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
      const errorText = await response.text().catch(() => "")
      throw new Error(
        `[API 错误] ${response.status} ${response.statusText}${errorText ? `: ${errorText.slice(0, 200)}` : ""}`
      )
    }

    const data = (await response.json()) as {
      content?: Array<{
        type: string
        text?: string
      }>
    }

    const textBlocks = (data.content ?? []).filter(
      (b) => b.type === "text" && typeof b.text === "string"
    )

    return textBlocks.map((b) => b.text!).join("")
  }

  async streamChat(
    messages: ChatMessage[],
    tools?: unknown[]
  ): Promise<StreamResult> {
    const { systemPrompt, messages: anthropicMessages } =
      convertMessagesToAnthropic(messages)

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 4096,
      messages: anthropicMessages,
      stream: true,
    }

    if (systemPrompt) {
      body.system = systemPrompt
    }

    if (tools && tools.length > 0) {
      body.tools = convertOpenAIToolsToAnthropic(tools)
    }

    let response: Response
    try {
      response = await fetch(`${this.baseURL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
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
      const errorText = await response.text().catch(() => "")
      throw new Error(
        `[API 错误] ${response.status} ${response.statusText}${errorText ? `: ${errorText.slice(0, 200)}` : ""}`
      )
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("[网络错误] 无法获取响应流")
    }

    const decoder = new TextDecoder("utf-8")
    let buffer = ""
    let fullContent = ""

    const toolUseMap = new Map<
      string,
      { id: string; name: string; inputJson: string }
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

        let event: Record<string, unknown>
        try {
          event = JSON.parse(data)
        } catch {
          process.stderr.write(
            `[警告] 无法解析 SSE chunk: ${data.slice(0, 80)}\n`
          )
          continue
        }

        const eventType = event.type as string | undefined

        if (eventType === "content_block_delta") {
          const delta = event.delta as
            | { type: string; text?: string; partial_json?: string }
            | undefined
          if (!delta) continue

          if (delta.type === "text_delta" && typeof delta.text === "string") {
            fullContent += delta.text
            process.stdout.write(delta.text)
          }

          if (
            delta.type === "input_json_delta" &&
            typeof delta.partial_json === "string"
          ) {
            const index = (event.index as number) ?? 0
            const key = String(index)
            if (!toolUseMap.has(key)) {
              toolUseMap.set(key, {
                id: "",
                name: "",
                inputJson: "",
              })
            }
            toolUseMap.get(key)!.inputJson += delta.partial_json
          }
        }

        if (eventType === "content_block_start") {
          const contentBlock = event.content_block as
            | { type: string; id?: string; name?: string }
            | undefined
          const index = (event.index as number) ?? 0
          const key = String(index)

          if (contentBlock?.type === "tool_use") {
            toolUseMap.set(key, {
              id: (contentBlock.id as string) ?? "",
              name: (contentBlock.name as string) ?? "",
              inputJson: "",
            })
          }
        }
      }
    }

    const toolCalls: AssistantToolCall[] = Array.from(toolUseMap.values())
      .filter((tc) => tc.name !== "")
      .map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: decodeUnicode(tc.inputJson || "{}"),
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
