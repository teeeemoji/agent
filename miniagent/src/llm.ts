import "dotenv/config"

export type PromptRole = "default" | "coding" | "explain" | "review"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
}

interface ChatCompletionChoice {
  message: {
    role: string
    content: string
  }
  finish_reason: string
}

interface ChatCompletionResponse {
  id: string
  choices: ChatCompletionChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export function getApiConfig() {
  const apiKey = process.env.LLM_API_KEY
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1"
  const model = process.env.LLM_MODEL ?? "gpt-4o"

  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY 未设置。请在 .env 文件中配置: LLM_API_KEY=your-api-key",
    )
  }

  return { apiKey, baseUrl, model }
}

export async function chat(params: {
  systemPrompt: string
  userMessage: string
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<{ content: string; usage?: ChatCompletionResponse["usage"] }> {
  const { apiKey, baseUrl, model: defaultModel } = getApiConfig()

  const body: ChatCompletionRequest = {
    model: params.model ?? defaultModel,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessage },
    ],
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens,
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API 调用失败 (${response.status}): ${errorText}`)
  }

  const data: ChatCompletionResponse = await response.json()

  if (!data.choices?.length) {
    throw new Error("LLM 返回空响应")
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  }
}

interface StreamChatResult {
  content: string
  usage?: ChatCompletionResponse["usage"]
}

export async function streamChat(
  params: {
    systemPrompt: string
    userMessage: string
    model?: string
    temperature?: number
    maxTokens?: number
  },
  onToken: (token: string) => void,
): Promise<StreamChatResult> {
  const { apiKey, baseUrl, model: defaultModel } = getApiConfig()

  const body = {
    model: params.model ?? defaultModel,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessage },
    ],
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens,
    stream: true,
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LLM API 调用失败 (${response.status}): ${errorText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("响应体不可读")
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let fullContent = ""
  let usage: ChatCompletionResponse["usage"] | undefined

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
      if (data === "[DONE]") continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          fullContent += content
          onToken(content)
        }
        if (parsed.usage) {
          usage = parsed.usage
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  return { content: fullContent, usage }
}