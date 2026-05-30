# Stage 03 — 多轮对话与历史管理

> **承上**：Stage 02 实现了流式输出，但每次对话独立，无记忆
> **启下**：对话历史是 Agent Loop 的基础数据结构，后续 tool-call 结果也需要注入历史

---

## 学习目标

1. 理解 LLM 的 messages 数组作为对话状态的本质
2. 掌握对话历史的数据结构设计与内存管理
3. 理解 context window 的概念和 token 消耗

## 核心概念

### Messages 数组 = 对话状态

LLM 本身是无状态的。所有"记忆"都来自我们把历史消息原样传回去：

```
Turn 1:
  messages = [
    { role: "system", content: "..." },
    { role: "user",   content: "写一个排序函数" }
  ]
  response = { role: "assistant", content: "def sort(arr): ..." }

Turn 2:
  messages = [
    { role: "system",    content: "..." },
    { role: "user",      content: "写一个排序函数" },
    { role: "assistant", content: "def sort(arr): ..." },
    { role: "user",      content: "改成降序" }           ← 新消息
  ]
```

### Token 消耗递增

每轮对话都会让 messages 数组变长，token 消耗线性增长。这是 Agent 系统的核心矛盾。

## 产出物

在 Stage 02 基础上修改：
- 新增 `conversation.ts` 管理对话历史
- `index.ts` 改为 REPL 循环（Read-Eval-Print-Loop）
- 按 `/exit` 退出对话

## 实现要点

- 用内存数组存储 messages
- 每轮对话追加 user + assistant 消息
- 打印当前 token 估算（可用 `tiktoken` 或简单字符估算）
- 支持 `/clear` 清空对话历史

---

## 技术洞察

### OpenCode 的做法

OpenCode 的消息管理要复杂得多：

1. **Messages 不是简单数组，是 Part 数组**
   每条消息由多个 Part 组成：text、tool-invocation、reasoning、file、image、agent。这比单纯的 `{role, content}` 灵活得多。

2. **消息存储在 SQLite 中**
   不在内存中——每次对话都从 DB 加载，跨进程持久化。

3. **消息有完整的处理管道**
   ```
   内部 Message 结构 → MessageV2.toModelMessages() → ProviderTransform → LLM API
   ```
   内部数据结构 != API 发送的数据。中间有格式转换层。

### 对比其他 Agent

| Agent | 历史存储 | 数据结构 | 特点 |
|-------|---------|---------|------|
| **OpenCode** | SQLite（Drizzle ORM） | Part 数组多态 | 持久化、可分支、可跨 session |
| **Claude Code** | 文件（JSON） | messages 数组 | 会话间独立 |
| **Aider** | Git 的 chat history 文件 | markdown | Git 版本控制 |
| **ChatGPT Web** | 服务端存储 | 简化 messages | 平台管理 |

### 关键洞察

对话历史管理看似简单，实际是 Agent 系统最基础也最容易出问题的部分：
- **上下文膨胀**：随着对话进行，messages 越来越长，token 成本越来越高
- **信息丢失**：如果只存 `{role, content}`，tool-call 的参数和结果会被简化，丢失关键信息
- **多 Agent 场景**：子 Agent 的消息历史如何与主 Agent 隔离？如何跨 Session 复用？

OpenCode 选择用 SQLite + 多态 Part 系统解决这些问题——这在 Stage 11 和 Stage 12 会详细展开。

**下一步**：当前 LLM 只能"说话"，不能"动手"。Stage 04 会实现 Agent Loop——让 LLM 调用工具。