import { PromptRole } from "./llm.js"

const DEFAULT_SYSTEM_PROMPT = `你是一个专业的 AI 编程助手。

你的职责是帮助开发者编写高质量的代码。在回答时：
- 提供清晰的代码示例
- 解释关键设计决策
- 遵循最佳实践和安全规范
- 用中文回答，代码中的注释可以用英文`

const PROMPTS: Record<string, string> = {
  default: DEFAULT_SYSTEM_PROMPT,
  coding: `你是一个专注于代码实现的 AI 助手。
- 优先考虑代码的正确性和可维护性
- 提供完整的可运行代码
- 包含必要的错误处理`,

  explain: `你是一个专注于代码讲解的 AI 助手。
- 用通俗易懂的方式解释代码
- 说明为什么这样设计
- 对比不同的实现方案`,

  review: `你是一个专注于代码审查的 AI 助手。
- 检查代码的安全漏洞
- 指出性能问题
- 建议更好的实现方式`,
}

export interface PromptConfig {
  role?: PromptRole
  customPrompt?: string
}

export function buildSystemPrompt(config: PromptConfig = {}): string {
  if (config.customPrompt) {
    return config.customPrompt
  }

  const promptKey = config.role ?? "default"
  return PROMPTS[promptKey] ?? DEFAULT_SYSTEM_PROMPT
}

export function listPromptRoles(): string[] {
  return Object.keys(PROMPTS)
}