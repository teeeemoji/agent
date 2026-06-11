import { streamChatWithTools } from "./llm.js"
import type { ToolRegistry } from "./tool-registry.js"
import type { Conversation } from "./conversation.js"
import { PermissionManager } from "./permission/permission-manager.js"

export interface AgentTurnResult {
  finalResponse: string
  turnsUsed: number
}

export interface AgentOptions {
  maxTurns?: number
  askConfirm?: (message: string) => Promise<boolean>
}

export async function runAgent(
  conversation: Conversation,
  userInput: string,
  toolRegistry: ToolRegistry,
  permissionManager: PermissionManager,
  options?: AgentOptions
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

      const input = PermissionManager.extractInput(tc.name, parsedArgs)
      const permission = permissionManager.checkPermission(tc.name, input)

      if (permission === "deny") {
        const msg = `[权限] ${tc.name} "${input.slice(0, 80)}" 被拒绝`
        process.stdout.write(`  ${msg}\n`)
        conversation.addToolResult(
          tc.id,
          tc.name,
          `权限拒绝: 工具 "${tc.name}" 操作 "${input}" 被权限规则拒绝`
        )
        continue
      }

      if (permission === "ask") {
        const question = `  [权限] 是否允许执行 ${tc.name} "${input.slice(0, 80)}" ？`
        const confirmed = options?.askConfirm
          ? await options.askConfirm(question)
          : false

        if (!confirmed) {
          process.stdout.write(`  [权限] ${tc.name} 被用户拒绝\n`)
          conversation.addToolResult(
            tc.id,
            tc.name,
            `用户拒绝了工具 "${tc.name}" 的执行请求`
          )
          continue
        }
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
