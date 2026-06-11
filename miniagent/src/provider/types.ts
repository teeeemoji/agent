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

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

export interface StreamResult {
  content: string
  toolCalls: ToolCall[]
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
