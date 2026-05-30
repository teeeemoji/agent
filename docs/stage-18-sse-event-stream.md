# Stage 18 — SSE（Server-Sent Events）事件流

> **承上**：Stage 17 实现了 HTTP API，但流式输出无法通过普通 HTTP 传递
> **启下**：SSE 让多客户端能实时看到 Agent 的思考过程，是 TUI 体验的基础

---

## 学习目标

1. 理解 SSE 协议的标准格式和使用场景
2. 掌握 Hono 中 SSE 端点的实现
3. 理解事件总线（Event Bus）的设计——如何广播给多个客户端

## 核心概念

### SSE vs WebSocket

| | SSE | WebSocket |
|------|-----|-----------|
| 方向 | Server → Client（单向） | 双向 |
| 协议 | HTTP（标准） | 升级为 WS |
| 自动重连 | ✅ 内置 | ❌ 需手动 |
| 复杂度 | 低 | 高 |
| 适用场景 | 实时推送（Agent 适合） | 聊天、游戏 |

Agent 场景中，Client 只需接收 Server 推送——不需要双向。SSE 更适合。

### SSE 事件流设计

```
SSE Endpoint: GET /api/events?session=xxx

Server → Client:
  event: delta
  data: {"content": "我来写一个...", "messageId": "msg-123"}

  event: tool-start
  data: {"toolName": "read", "args": {"file_path": "src/main.ts"}, "state": "executing"}

  event: tool-end
  data: {"toolName": "read", "result": "...", "state": "completed"}

  event: turn-end
  data: {"finishReason": "stop"}
```

### Event Bus 设计

```
Agent Loop 产出事件
    │
    ▼
Event Bus (内存中)
    ├── SSE Client 1 (TUI)
    ├── SSE Client 2 (Web UI)
    └── SSE Client 3 (Headless CLI)
```

## 产出物

在 Stage 17 基础上：
- `server/sse/event-bus.ts` — 事件总线
- `server/sse/sse-handler.ts` — SSE 端点实现
- 修改 `agent-loop.ts` 通过 Event Bus 发送事件
- 修改 CLI 客户端支持 SSE 接收流式输出

## 实现要点

- Event Bus 使用 EventEmitter 或自定义 Observer 模式
- SSE 端点设置正确的 HTTP headers（`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`）
- 自动断线重连（SSE 内置，Client 侧处理）
- 事件类型：`delta`（流式文本）、`tool-start`、`tool-end`、`turn-end`、`error`

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 SSE 设计与 Part 系统深度结合：

1. **全局事件端点**
   ```
   GET /global/event
   ```
   所有客户端都连接到同一个 SSE 端点，接收全局事件广播。

2. **Part 状态变更事件**
   ```
   event: part-update
   data: {
     messageId: "msg-123",
     partIndex: 1,
     part: {
       type: "tool-invocation",
       state: "executing",     ← 状态变化！
       toolName: "read",
       args: {...}
     }
   }
   ```
   Part 的每次状态变更（pending→executing→completed）都会通过 SSE 推送。

3. **多 Client 同步**
   同一个 Session 可以有多个客户端：
   ```
   TUI Client  ──SSE──┐
                      ├── Event Bus ── Agent Loop
   Web Client ──SSE──┘
   ```
   当你在 TUI 中发送消息，Web UI 也能实时看到 Agent 的响应。

### 对比其他 Agent

| Agent | 实时通知 | 多 Client 同步 |
|-------|---------|--------------|
| **OpenCode** | SSE + Event Bus | ✅ 全局广播 |
| **Claude Code** | TUI 内置 | ❌ 单 Client |
| **Aider** | 终端直接输出 | ❌ 单 Client |
| **Cursor** | IDE 内部通知 | ❌ 单 Client |

### 关键洞察

SSE 不是"锦上添花"的功能——它是 **Agent 与 Client 之间的主要通信协议**：

- Agent Loop 的每一次输出（text delta, tool call, tool result, finish reason）都通过 SSE 事件传递
- HTTP POST 只是触发 Agent Loop 的"命令"，SSE 才是获取结果的"通道"
- 这种设计将 Agent 的输出变成了一个**可观察的事件流**（Observable Stream），无论是渲染到 TUI 还是记录到日志，都是对这个事件流的"订阅"

**下一步**：SSE 让流式数据能到达客户端了。Stage 19 实现基础 TUI。