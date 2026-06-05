const prompts: Record<string, string> = {
  default: `你是一个专业的编程助手。请用中文回答用户的问题。`,
  "code-assistant": `你是一个资深的编程专家，精通多种编程语言和软件架构。
你的回答风格：
- 先给出直接答案，再展开详细解释
- 代码示例使用现代最佳实践
- 指出可能的陷阱和替代方案
- 用中文回答`,
  general: `你是一个乐于助人的 AI 助手。请用中文回答用户的问题，力求准确、清晰、有帮助。`,
}

export function getSystemPrompt(name?: string): string {
  if (!name) {
    return prompts.default
  }
  if (prompts[name]) {
    return prompts[name]
  }
  console.warn(`未找到名为 "${name}" 的 prompt，使用默认值`)
  return prompts.default
}
