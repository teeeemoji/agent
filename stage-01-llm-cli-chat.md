# Stage 01 — 最小可运行的 LLM CLI 对话

> **承上**：项目起点，无前置依赖
> **启下**：为 Stage 02 的流式输出打下基础

---

## 学习目标

1. 理解 LLM API 的基本调用范式（Chat Completion API）
2. 掌握 CLI 程序的输入输出设计
3. 理解 `system prompt` 的概念和对 Agent 行为的影响

## 核心概念

### LLM Chat Completion API

这是所有 AI Agent 的基础。无论用 OpenAI、Anthropic 还是其他 Provider，核心模式都是：

```
POST /chat/completions
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "你是一个编程助手" },
    { "role": "user",   "content": "用 Python 写一个 hello world" }
  ]
}
```

### System Prompt

System Prompt 是塑造 Agent 行为的最基本手段。在这个阶段，你会直观感受到同一模型在不同 system prompt 下输出的巨大差异。

## 产出物

```
miniagent/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # CLI 入口
│   ├── llm.ts            # LLM API 调用封装
│   └── prompts.ts        # System prompt 管理
```

## 实现要点

- 读取用户输入 → 调用 LLM API → 打印响应
- 支持单轮对话（一问一答）
- 使用 Node.js / Bun 均可
- 通过 `.env` 管理 API key

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 system prompt 是**动态构建**的，不是一个固定字符串。它会根据：
- 当前 Agent 角色（Build vs Plan）
- 当前项目上下文（文件结构、语言类型）
- 用户配置（opencode.json）

动态拼装 system prompt。这是它能做到"上下文感知"的基础。

### 对比其他 Agent

| Agent | System Prompt 策略 |
|-------|-------------------|
| **OpenCode** | 动态构建，按 Agent 角色、项目上下文分层组合 |
| **Claude Code** | Anthropic 内部定制，用户不可见 |
| **Aider** | 固定模板 + 少量动态信息（git 状态） |
| **LangChain Agent** | 用户完全自定 prompt 模板 |

### 关键洞察

大多数开发者使用 LLM 时，只关注 `user` 消息的内容，忽略 `system` 消息的设计。但在 Agent 系统中，system prompt 的质量直接决定了 Agent 的行为模式、工具使用策略和输出风格。OpenCode 证明了 system prompt **不应该是静态的**——它会随 Agent 角色、当前上下文而变化。

**下一步**：当前只能一问一答，无法对话。Stage 02 会加入流式输出和实时打字效果。