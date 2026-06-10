import { streamChatWithTools } from "./llm.js"
import type { ToolRegistry } from "./tool-registry.js"
import type { Conversation } from "./conversation.js"

export interface AgentTurnResult {
  finalResponse: string
  turnsUsed: number
}

export async function runAgent(
  conversation: Conversation,
  userInput: string,
  toolRegistry: ToolRegistry,
  options?: { maxTurns?: number }
): Promise<AgentTurnResult> {
  const maxTurns = options?.maxTurns ?? 10

  conversation.addUserMessage(userInput)

  for (let turn = 0; turn < maxTurns; turn++) {
    const messages = conversation.getAllMessages()
    const tools = toolRegistry.toOpenAITools()

    const result = await streamChatWithTools(messages, tools)

    if (result.toolCalls.length === 0) {
      conversation.addAssistantMessage(result.content || null)
      return { finalResponse: result.content, turnsUsed: turn + 1 }
    }

    conversation.addAssistantMessage(
      result.content || null,
      result.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      }))
    )

    for (const tc of result.toolCalls) {
      let parsedArgs: Record<string, unknown> = {}
      try {
        parsedArgs = JSON.parse(tc.arguments)
      } catch {
        parsedArgs = {}
      }

      const toolResult = await toolRegistry.execute(tc.name, parsedArgs)

      process.stdout.write(`  [工具 ${tc.name}] ${toolResult.result.slice(0, 200)}${toolResult.result.length > 200 ? "..." : ""}\n`)

      conversation.addToolResult(tc.id, tc.name, toolResult.result)
    }
  }

  const warning = "(已达到最大轮次限制，Agent 循环终止)"
  process.stdout.write(`${warning}\n`)
  conversation.addAssistantMessage(warning)
  return { finalResponse: warning, turnsUsed: maxTurns }
}

export function buildSystemPrompt(basePrompt: string): string {
  return basePrompt
}
