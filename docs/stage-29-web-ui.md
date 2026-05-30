# Stage 29 — Web UI

> **承上**：Client/Server 架构（Stage 17）让多客户端成为可能，TUI（Stage 19）是第一个客户端
> **启下**：Web UI 是第二个客户端，验证了 Client/Server 架构的价值

---

## 学习目标

1. 理解 Web UI 与 TUI 的差异——渲染能力 vs 终端限制
2. 掌握 SSE 在浏览器中的使用（EventSource API）
3. 理解如何让 Web UI 与 TUI 共享同一个 Server

## 核心概念

### Web UI 架构

```
Browser
  ├── React / SolidJS 前端
  ├── SSE (EventSource) → 接收 Agent 实时输出
  └── HTTP (fetch) → 发送消息到 Server

Server (不变)
  ├── Hono HTTP API
  ├── SSE Endpoint
  └── Agent Loop
```

### Web UI vs TUI

| 能力 | TUI | Web UI |
|------|-----|--------|
| 语法高亮 | Tree-sitter（终端限制） | 任意 JS 库（如 Prism, Shiki） |
| Diff 显示 | 颜色区分 | 交互式 diff（Monaco Editor） |
| 代码编辑 | 终端编辑器 | 完整编辑器 |
| 文件树 | 无 | 侧边栏文件树 |
| 多 session | Tab 切换 | 侧边栏 session 列表 |

### SSE 在浏览器中

```javascript
// 浏览器原生 EventSource
const es = new EventSource("/api/events?session=xxx")

es.addEventListener("delta", (e) => {
  const { content, messageId } = JSON.parse(e.data)
  appendToChat(content)
})

es.addEventListener("tool-start", (e) => {
  const { toolName, args } = JSON.parse(e.data)
  showToolExecution(toolName, args)
})

es.addEventListener("tool-end", (e) => {
  const { toolName, result } = JSON.parse(e.data)
  showToolResult(toolName, result)
})
```

## 产出物

在 Stage 28 基础上：
- `web/` — 前端项目（React + Vite）
- `web/src/App.tsx` — 主应用
- `web/src/components/ChatView.tsx` — 对话视图
- `web/src/components/ToolExecutionCard.tsx` — 工具执行卡片
- `web/src/hooks/useSSE.ts` — SSE Hook
- Server 增加静态文件服务（从同一端口提供前端）

## 实现要点

- 前端框架：React（或 SolidJS）
- SSE 接收：浏览器 `EventSource` API
- 消息发送：`POST /api/sessions/:id/messages`
- 代码高亮：Shiki / Prism / highlight.js
- Server 添加 CORS（开发阶段）

---

## 技术洞察

### OpenCode 的做法

OpenCode 有 Web UI（除了 TUI 之外），但 **Web UI 不是主打**：

1. **OpenCode 的定位是 Terminal-first**
   Web UI 是补充，不是替代。核心体验仍在终端。

2. **OpenTUI 优先于 Web UI**
   OpenCode 投入极大的精力做 OpenTUI（Zig + SolidJS），Web UI 相对简单。

3. **Web UI 适合的补充场景**
   - 快速开始（不想安装 CLI）
   - 演示/分享（有 URL 即可）
   - 视觉化操作（文件树、diff viewer）

4. **技术栈**
   前端：SolidJS（与 TUI 相同，共享组件逻辑的**可能性**）

### 对比其他 Agent

| Agent | Web UI | 定位 |
|-------|--------|------|
| **OpenCode** | ✅ 有（补充） | Terminal-first，Web 为辅 |
| **Claude Code** | ❌ 无 | 纯终端 |
| **Aider** | ❌ 无 | 纯终端 |
| **ChatGPT** | ✅ 有（主打） | Web-first |
| **Cursor** | ❌ 无（IDE） | IDE-first |

### 关键洞察

Web UI 在这个学习项目中的价值不在于"做一个漂亮的界面"，而在于**验证 Client/Server 架构的正确性**：

- TUI Client 连接同一个 Server → 看到同一个 session
- Web UI 连接同一个 Server → 也看到同一个 session
- 这说明**Server 层是真正的核心，Client 层是可替换的**

这个验证对于系统架构的理解非常重要：当你加一个新 Client 时，如果不需要修改 Server 的任何代码，说明架构设计是解耦的、正确的。

**下一步**：Web UI 完成了。Stage 30 实现 Desktop 应用（Tauri）。