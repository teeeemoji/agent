# Stage 04 — Agent Loop 基础框架

> **承上**：Stage 03 实现了多轮对话，但 LLM 只能被动回答
> **启下**：Agent Loop 是整个系统的"心脏"，后续所有工具都在此框架下运行

---

## 学习目标

1. 理解 Agent Loop 的核心状态机：**感知 → 决策 → 执行 → 反馈**
2. 掌握 `stop` / `tool-calls` / `end_turn` 三种 finish_reason 的处理
3. 理解为什么 Agent Loop 是 Agent 和 Chatbot 的分水岭

## 核心概念

### Agent Loop 状态机

```
        ┌─────────────────────┐
        │   用户输入            │
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐
        │  构建 messages 数组   │ ← 包含历史 + 新输入
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐
        │  LLM 流式调用         │
        └──────────┬──────────┘
                   ▼
        ┌───────── finish_reason? ─────────┐
        │                                  │
    "stop"                          "tool_calls"
        │                                  │
        ▼                                  ▼
   ┌──────────┐                   ┌──────────────┐
   │ 返回结果  │                   │ 执行工具       │
   │ 结束循环  │                   │ 获得 result   │
   └──────────┘                   └──────┬───────┘
                                         │
                              追加 tool result 到 messages
                                         │
                                    ─────┘
                                   (循环回到 LLM 调用)
```

### Chatbot vs Agent 的本质区别

| | Chatbot | Agent |
|------|---------|-------|
| 输出 | 文本 | 文本 + tool-call |
| 循环 | 一轮 | 多轮（直到 finish_reason = stop） |
| 状态 | 仅消息 | 消息 + 工具执行结果 |
| 终止 | 单次响应结束 | stop / max_turns / error |

## 产出物

在 Stage 03 基础上修改：
- 新增 `agent-loop.ts` 实现 Agent 循环
- 新增 `tool-registry.ts` 工具注册表（空壳，为 Stage 05 做准备）
- 修改 `index.ts` 让 Agent Loop 驱动对话

## 实现要点

- 实现 `runAgent(userInput)` 函数
- 伪 tool-call 检测：LLM 返回文本中如果包含 `TOOL: xxx` 特殊标记，模拟触发工具调用
- 先实现一个伪工具 `echo` 用于验证循环逻辑
- 设置 `maxTurns = 10` 防止无限循环

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 Agent Loop 实现在 `SessionPrompt.loop()` 中，远比这个阶段复杂：

```
SessionPrompt.loop()
  ├── 构建用户消息（附加文件上下文、元数据）
  ├── 工具注册表解析（构建 AI SDK 工具定义）
  ├── 提醒插入（系统消息动态注入）
  ├── SessionProcessor.create() → 消息管道
  ├── LLM.stream() → 流式调用
  ├── 检测 finish_reason
  │   ├── "stop"      → 保存响应，返回
  │   ├── "tool-calls" → 权限检查 → 插件 Hook → 工具执行 → 循环
  │   └── "end_turn"  → Agent 主动结束（Plan Agent 常用）
  └── 错误处理 + 重试逻辑
```

关键设计点：

1. **Part 状态追踪**：工具调用状态 `pending → executing → completed | error` 实时通过 SSE 广播
2. **finish_reason = end_turn**：OpenCode 独有——Agent 可以"说完了，但不要继续"，Plan Agent 分析完就结束
3. **maxSteps 限制**：防止无限循环，可配置

### 对比其他 Agent

| Agent | Loop 实现 | 关键差异 |
|-------|----------|---------|
| **OpenCode** | `SessionPrompt.loop()`，Effect-TS 包裹 | end_turn 机制、Part 状态追踪 |
| **Claude Code** | Tool use loop（Anthropic API 原生） | 原生 tool-use 支持 |
| **Aider** | 自定义循环，function-calling 标准 | 编辑历史追踪 |
| **LangChain** | AgentExecutor，多种 Agent 类型 | 框架化、模板化 |

### 关键洞察

Agent Loop 不仅是"多调几次 LLM"，而是**一个完整的状态机**。这个状态机的质量决定了 Agent 系统的可靠性：

- **何时停止**：finish_reason = "stop" 是不够的——Agent 可能误以为自己完成了。OpenCode 的 `end_turn` 给了 Agent 一个更精确的"我已尽力"信号。
- **循环上限**：没有 maxSteps 的 Agent Loop = 潜在的无限花钱循环
- **误差传播**：每轮 tool-call 的结果如果错误，会被注入下一轮 LLM 调用，误差累积

**下一步**：当前只有一个伪工具。Stage 05 会实现真正的文件操作工具（read/write/edit）。