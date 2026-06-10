import type { ChatMessage } from "./llm.js"

export interface ToolCallRequest {
  id: string
  name: string
  arguments: string
}

export class Conversation {
  private messages: ChatMessage[]
  private systemMessage: ChatMessage | null

  constructor(systemPrompt?: string) {
    this.messages = []
    if (systemPrompt) {
      this.systemMessage = { role: "system", content: systemPrompt }
    } else {
      this.systemMessage = null
    }
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content })
  }

  addAssistantMessage(content: string | null, toolCalls?: ToolCallRequest[]): void {
    const msg: ChatMessage = {
      role: "assistant",
      content: content,
    }
    if (toolCalls && toolCalls.length > 0) {
      msg.tool_calls = toolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }))
    }
    this.messages.push(msg)
  }

  addToolResult(toolCallId: string, toolName: string, result: string): void {
    this.messages.push({
      role: "tool",
      content: result,
      tool_call_id: toolCallId,
    })
  }

  getAllMessages(): ChatMessage[] {
    const messages: ChatMessage[] = []
    if (this.systemMessage) {
      messages.push(this.systemMessage)
    }
    messages.push(...this.messages)
    return messages
  }

  estimateTokens(): number {
    let totalChars = 0
    if (this.systemMessage && typeof this.systemMessage.content === "string") {
      totalChars += this.systemMessage.content.length
    }
    for (const msg of this.messages) {
      totalChars += typeof msg.content === "string" ? msg.content.length : 0
    }
    return Math.ceil(totalChars / 4)
  }

  getTurnCount(): number {
    let count = 0
    for (const msg of this.messages) {
      if (msg.role === "user") count++
    }
    return count
  }

  clear(): void {
    this.messages = []
  }
}
