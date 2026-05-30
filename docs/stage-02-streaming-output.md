# Stage 02 — 流式输出（Streaming）

> **承上**：Stage 01 实现了基本 API 调用，但响应是一次性返回的
> **启下**：流式输出是实时交互体验的基础，也是 Agent Loop 中增量处理的前提

---

## 学习目标

1. 理解 LLM 的 SSE（Server-Sent Events）流式协议
2. 掌握流式输出的解析和逐字渲染
3. 理解为什么流式对 Agent 体验至关重要

## 核心概念

### 为什么需要流式

```
非流式（Stage 01）：
  用户输入 → [等待 3-10 秒] → 一次性输出全文

流式（Stage 02）：
  用户输入 → H → He → Hel → Hell → Hello → Hello, → ...
              ↑ 用户立刻看到响应开始
```

流式不仅改善体验，更重要的是让 Agent 系统能在 LLM 输出过程中**实时发现 tool-call**，从而提前终止生成并转向工具执行。

### SSE 协议结构

```
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Hello"}}]}
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":", "}}]}
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"world"}}]}
data: [DONE]
```

## 产出物

在 Stage 01 基础上修改：
- `llm.ts` 增加 `streamChat()` 函数
- `index.ts` 增加逐字打印逻辑

## 实现要点

- 使用 `fetch` 的流式读取（`response.body.getReader()`）
- 逐行解析 SSE data chunk
- 提取 `delta.content` 并立即渲染到终端
- 正确处理 `[DONE]` 结束信号

---

## 技术洞察

### OpenCode 的做法

OpenCode 的流式处理是整个架构的核心路径。它不是简单地逐字打印：

```
LLM Stream → SessionProcessor
  ├── 实时解析 delta content → SSE 广播给所有客户端
  ├── 实时检测 tool-call → 暂停流式，进入工具执行
  ├── 实时检测 finish-reason → 决定是否继续 Agent Loop
  └── 实时更新 Part 状态 → pending → executing → completed
```

流式输出同时驱动了：
- 客户端实时显示（TUI / Web / Desktop 同步）
- Agent Loop 的状态机转换
- Tool-call 的触发时机

### 对比其他 Agent

| Agent | 流式策略 | 特殊处理 |
|-------|---------|---------|
| **OpenCode** | 全链路流式（LLM → Processor → SSE → Client） | 流中检测 tool-call，即时中断 |
| **Claude Code** | TUI 直接消费流式 | — |
| **Aider** | 流式输出到终端 | 解析时缓存 tool-call |
| **ChatGPT Web** | 流式 + typing indicator | 富文本转换 |

### 关键洞察

流式输出不仅仅是"好看"。在 Agent 系统中，**流式是架构的基础设施**：
- Tool-call 的即时检测依赖流式解析
- 多客户端同步依赖流式广播（SSE）
- Context compaction 的触发时机依赖实时的 token 计数
- 用户中断（Ctrl+C）依赖流式中的 abort signal

OpenCode 把流式处理放到了 `SessionProcessor` 核心层，而不是 UI 层——这使得 TUI、Web UI、Headless 模式都能复用同一套流式逻辑。

**下一步**：当前只能一问一答。Stage 03 会加入对话历史管理，支持多轮对话。