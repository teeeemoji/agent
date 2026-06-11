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

export interface AssistantToolCall {
  id: string
  name: string
  arguments: string
}

export interface StreamResult {
  content: string
  toolCalls: AssistantToolCall[]
}

export interface ModelInfo {
  id: string
  name: string
}

export interface IProvider {
  chat(messages: ChatMessage[]): Promise<string>
  streamChat(messages: ChatMessage[], tools?: unknown[]): Promise<StreamResult>
  listModels(): ModelInfo[]
}

export type ProviderName = string

export interface ProviderModelId {
  provider: ProviderName
  modelId: string
}

export function parseProviderModelId(raw: string): ProviderModelId {
  const slashIndex = raw.indexOf("/")
  if (slashIndex < 0) {
    return { provider: raw, modelId: raw }
  }
  return {
    provider: raw.slice(0, slashIndex),
    modelId: raw.slice(slashIndex + 1),
  }
}

export interface ProviderTransform {
  name: string
  transform(messages: ChatMessage[]): ChatMessage[]
}

export interface AuthInfo {
  apiKey: string
  baseURL?: string
}

export type AuthSource = "env" | "auth_file" | "config" | "none"
