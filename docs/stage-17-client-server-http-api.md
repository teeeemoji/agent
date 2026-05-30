# Stage 17 — Client/Server 分离：HTTP API

> **承上**：前 16 个 Stage 是单体 CLI 程序
> **启下**：这是架构转折点——Agent 变成 HTTP Server，为多客户端和 Headless 模式铺路

---

## 学习目标

1. 理解为什么 AI Agent 需要 Client/Server 架构
2. 掌握 Hono 框架实现 REST API
3. 理解 API 优先设计的价值（OpenAPI 文档、多客户端）

## 核心概念

### 架构转变

```
之前（单体 CLI）：
  user → [CLI 入口 → Agent Loop → 工具执行 → 终端输出]
            ↑ 全在一个进程里

之后（Client/Server）：
  user → [TUI Client] ──HTTP──→ [OpenCode Server]
                                  ├── Agent Loop
                                  ├── 工具执行
                                  ├── Session 管理
                                  └── SQLite
```

### REST API 设计

```
POST /api/sessions             创建新 session
GET  /api/sessions             列出 session
GET  /api/sessions/:id         获取 session 详情
POST /api/sessions/:id/messages 发送消息（触发 Agent Loop）
GET  /api/sessions/:id/messages 获取消息历史
DELETE /api/sessions/:id        删除 session
GET  /api/tools                 列出可用工具
```

## 产出物

在 Stage 16 基础上：
- `server/index.ts` — Hono HTTP Server
- `server/routes/sessions.ts` — Session API
- `server/routes/messages.ts` — Message API
- `server/routes/tools.ts` — Tool API
- `server/middleware/project.ts` — 项目上下文中间件
- `cli/index.ts` 改为 HTTP Client

## 实现要点

- 使用 Hono（轻量 HTTP 框架，支持 OpenAPI 3.1）
- Agent Loop 在 Server 端执行（POST /messages 触发）
- CLI 通过 HTTP 调用 Server（作为第一个客户端）
- 添加 OpenAPI 文档端点 `/doc`

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 Client/Server 架构是其最关键的架构决策：

1. **启动流程**
   ```
   $ opencode
     ├── 启动 HTTP Server (Hono) → 监听 localhost:PORT
     └── 启动 TUI Client → 连接 localhost:PORT
   
   $ opencode serve
     └── 仅启动 HTTP Server（Headless 模式）
   
   $ opencode web
     ├── 启动 HTTP Server
     └── 启动 Web UI Client
   ```

2. **API 文档自动生成**
   Hono + OpenAPI 3.1 中间件自动从路由定义生成 `/doc` 端点的 API 文档。

3. **统一的 API 认证**
   所有客户端（TUI/Web/Desktop/IDE）通过同一个 API 与 Server 通信。

4. **项目上下文通过 HTTP Header 传递**
   ```
   GET /api/sessions
   Header: X-Project-Dir: /home/user/project-a
   ```

### 对比其他 Agent

| Agent | 架构 | API 开放性 |
|-------|------|-----------|
| **OpenCode** | Client/Server (Hono + OpenAPI 3.1) | ✅ 完全开放 |
| **Claude Code** | 单体 TUI | ❌ 无 API |
| **Aider** | 单体 CLI | ❌ 无 API |
| **Cursor** | IDE 插件 + 后端服务 | ❌ 无公开 API |

### 关键洞察

大多数 Agent 工具选择了单体架构：一切都在一个进程中。OpenCode 选择 Client/Server 架构，带来了几个根本性的优势：

1. **Headless 模式**：`opencode serve` 让 Agent 可以在 CI/CD 流水线中运行
2. **远程开发**：Server 在开发机上，Client 在本地终端
3. **多 Client 同步**：TUI 和 Web UI 同时连接同一个 Server，看到同一个 Session
4. **第三方集成**：通过 REST API，其他工具可以集成 OpenCode 能力

这个架构选择的代价是复杂度——需要处理 HTTP 的序列化/反序列化、身份认证、错误传播等。但收益是让 OpenCode 从一个"工具"变成了一个"平台"。

**下一步**：HTTP API 是请求-响应模式，对于流式输出需要 SSE。Stage 18 实现 SSE 事件流。