export interface Tool {
  name: string
  description: string
  execute: (args: string) => Promise<string> | string
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  async execute(name: string, args: string): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) {
      return `错误: 工具 "${name}" 未注册`
    }
    try {
      return await tool.execute(args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `错误: 工具 "${name}" 执行失败: ${message}`
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
}

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry()

  registry.register({
    name: "echo",
    description: "回显输入的内容，用于测试 Agent Loop 是否正常工作",
    execute: (args: string) => {
      return `echo: ${args}`
    },
  })

  return registry
}
