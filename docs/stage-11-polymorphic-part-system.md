# Stage 11 — 消息系统重构：多态 Part

> **承上**：前 10 个 Stage 的消息用 `{role, content}` 简单结构
> **启下**：Part 系统是消息扩展性的核心，也是后续工具状态追踪、子 Agent 消息的基础

---

## 学习目标

1. 理解多态 Part 设计的核心价值——扩展性
2. 掌握从简单 messages 迁移到 Part 数组的重构方法
3. 理解不同类型 Part 的 schema 和渲染差异

## 核心概念

### 从简单 Content 到 Part 数组

```
旧结构（前 10 Stage）：
  message = { role: "assistant", content: "我来写一个函数..." }

新结构（Part 数组）：
  message = {
    role: "assistant",
    parts: [
      { type: "text", content: "我来写一个函数..." },
      { type: "reasoning", content: "用户需要排序函数..." },
      { type: "tool-invocation", toolName: "write", args: {...}, result: "..." }
    ]
  }
```

### Part 类型

```typescript
type Part =
  | { type: "text";             content: string }
  | { type: "tool-invocation";  toolName: string; state: "pending"|"executing"|"completed"|"error"; args: {}; result: any }
  | { type: "reasoning";        content: string }
  | { type: "file";             path: string; content: string }
```

### Part 的优势

1. **状态追踪**：tool-invocation Part 有状态（pending → executing → completed）
2. **多模态**：将来可以加 image、audio、agent 等类型，不影响现有逻辑
3. **独立渲染**：每种 Part 有自己的渲染方式（text 渲染成文字，tool 渲染成执行卡片）

## 产出物

在 Stage 10 基础上重构：
- `message/part-types.ts` — Part 类型定义
- `message/message.ts` — 新 Message 结构
- `message/part-renderer.ts` — Part 渲染
- 重构 `agent-loop.ts` 使用新消息结构
- 重构 `conversation.ts` 存储 Part 数组

## 实现要点

- Part 使用 discriminated union（tagged union）实现类型安全
- tool-invocation Part 状态流转：`pending → executing → completed | error`
- 实现 `toModelMessages()` 把内部 Part 结构转为 Provider API 需要的格式
- 不同 Part 类型用不同的渲染逻辑（CLI 先用颜色区分）

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 Part 系统远比本阶段复杂：

```
OpenCode Part 类型：
  text             — 文字内容
  tool-invocation  — 工具调用（含状态追踪）
  reasoning        — 推理过程（Claude 的 thinking）
  file             — 文件引用
  image            — 图片（多模态）
  agent            — 子 Agent 引用（指向子 Agent 的 session）
```

关键设计：

1. **每种 Part 有独立的数据库列**
   不是简单的 JSON 序列化，而是通过 Drizzle ORM 的类型化存储。

2. **Part 到 API format 的转换**
   ```typescript
   MessageV2.toModelMessages()
   // 内部 Part[] → AI SDK 格式的 messages[]
   ```
   这是 OpenCode 的核心转换——内部灵活 vs 外部标准之间的桥梁。

3. **Part 状态通过 SSE 实时广播**
   tool-invocation 的状态变更（pending→executing→completed）通过 SSE 推送给客户端，让 UI 实时更新。

### 对比其他 Agent

| Agent | 消息结构 | 扩展性 |
|-------|---------|--------|
| **OpenCode** | 多态 Part 数组 | 极高（加新类型不破坏旧逻辑） |
| **Claude Code** | Tool Use 原生结构 | Anthropic API 决定 |
| **Aider** | 简单的 messages 列表 | 有限 |
| **LangChain** | 各类 Message 子类 | 中（继承体系） |

### 关键洞察

大多数 Agent 系统把消息当"聊天记录"处理，OpenCode 把消息当"结构化事件流"处理。这个思维转变很重要：

- **聊天记录思维**：messages 是一段对话，存下来是为了下次能看
- **事件流思维**：messages 是一系列结构化事件（text、tool-call、reasoning、agent），每种事件有不同的生命周期和处理逻辑

Part 系统的真正价值在 Stage 22 的子 Agent 中会完全体现：子 Agent 的结果是一个 `agent` Part，它包含指向子 Agent session 的引用，可以在 TUI 中展开查看子 Agent 的完整对话。

**下一步**：Part 系统让消息结构变灵活了。Stage 12 把对话持久化到 SQLite。