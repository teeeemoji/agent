import { streamChat } from "./llm.js"
import type { ToolRegistry } from "./tool-registry.js"
import type { Conversation } from "./conversation.js"

const TOOL_PATTERN = /TOOL:(\w+)(?:\s+(.*))?/

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
    let fullResponse = ""

    for await (const chunk of streamChat(messages)) {
      process.stdout.write(chunk)
      fullResponse += chunk
    }
    process.stdout.write("\n")

    const toolMatches = parseToolCalls(fullResponse)

    if (toolMatches.length === 0) {
      conversation.addAssistantMessage(fullResponse)
      return { finalResponse: fullResponse, turnsUsed: turn + 1 }
    }

    conversation.addAssistantMessage(fullResponse)

    for (const { toolName, toolArgs } of toolMatches) {
      const result = await toolRegistry.execute(toolName, toolArgs)
      process.stdout.write(`  [工具 ${toolName}] ${result}\n`)
      conversation.addToolResult(toolName, result)
    }
  }

  const warning = "(已达到最大轮次限制，Agent 循环终止)"
  process.stdout.write(`${warning}\n`)
  conversation.addAssistantMessage(warning)
  return { finalResponse: warning, turnsUsed: maxTurns }
}

function parseToolCalls(text: string): Array<{ toolName: string; toolArgs: string }> {
  const results: Array<{ toolName: string; toolArgs: string }> = []
  const regex = /TOOL:(\w+)(?:\s+([^\n]*))?/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const toolName = match[1]
    const toolArgs = (match[2] ?? "").trim()
    if (toolName) {
      results.push({ toolName, toolArgs })
    }
  }
  return results
}

export function buildSystemPrompt(basePrompt: string, registry: ToolRegistry): string {
  const toolDescriptions = registry.getToolDescriptions()
  return `${basePrompt}

当前可用的工具:
${toolDescriptions}

当需要调用工具时，请在回复中使用以下格式（可出现在回复的任意位置）:
TOOL:<工具名> <参数>

工具调用后，工具的执行结果会自动注入到你的上下文中，你可以基于结果继续生成回复。
如果不需要调用工具，直接回答即可。`
}
