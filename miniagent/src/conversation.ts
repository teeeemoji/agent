import type { ChatMessage } from "./llm.js"

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

  addAssistantMessage(content: string): void {
    this.messages.push({ role: "assistant", content })
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
    if (this.systemMessage) {
      totalChars += this.systemMessage.content.length
    }
    for (const msg of this.messages) {
      totalChars += msg.content.length
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
