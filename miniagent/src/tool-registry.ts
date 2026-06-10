import type { ChatCompletionTool } from "openai/resources/chat/completions"

export interface ToolParameterProperty {
  type: string
  description: string
  enum?: string[]
}

export interface ToolParameters {
  type: "object"
  properties: Record<string, ToolParameterProperty>
  required: string[]
  [key: string]: unknown
}

export interface Tool {
  name: string
  description: string
  parameters: ToolParameters
  execute: (args: Record<string, unknown>) => Promise<string> | string
}

interface ToolCallResult {
  tool_call_id: string
  toolName: string
  result: string
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        tool_call_id: "",
        toolName: name,
        result: `错误: 工具 "${name}" 未注册`,
      }
    }
    try {
      const result = await tool.execute(args)
      return {
        tool_call_id: "",
        toolName: name,
        result: typeof result === "string" ? result : JSON.stringify(result),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        tool_call_id: "",
        toolName: name,
        result: `错误: 工具 "${name}" 执行失败: ${message}`,
      }
    }
  }

  getNames(): string[] {
    return Array.from(this.tools.keys())
  }

  getDescription(name: string): string | undefined {
    return this.tools.get(name)?.description
  }

  getToolDescriptions(): string {
    if (this.tools.size === 0) {
      return "(暂无可用工具)"
    }
    let result = ""
    for (const tool of this.tools.values()) {
      result += `- ${tool.name}: ${tool.description}\n`
    }
    return result.trimEnd()
  }

  toOpenAITools(): ChatCompletionTool[] {
    const result: ChatCompletionTool[] = []
    for (const tool of this.tools.values()) {
      result.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })
    }
    return result
  }
}

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry()

  registry.register({
    name: "echo",
    description: "回显输入的内容，用于测试 Agent Loop 是否正常工作",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "要回显的消息内容" },
      },
      required: ["message"],
    },
    execute: (args: Record<string, unknown>) => {
      return `echo: ${args.message}`
    },
  })

  return registry
}
