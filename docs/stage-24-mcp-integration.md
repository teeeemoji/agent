# Stage 24 — MCP（Model Context Protocol）集成

> **承上**：Agent 有内置工具（read, write, bash, lsp 等），但工具是固定的
> **启下**：MCP 让工具系统能无限扩展，第三方可以提供新工具

---

## 学习目标

1. 理解 MCP 协议的核心概念（Server、Tool、Resource）
2. 掌握 MCP Client 的实现（stdio 和 HTTP 两种传输）
3. 理解如何将 MCP 工具无缝集成到 Agent 的工具注册表

## 核心概念

### MCP 是什么

MCP 是 Anthropic 推出的开放协议，定义了 LLM 与外部工具/数据源交互的标准方式：

```
Agent (MCP Client) ──MCP Protocol──→ MCP Server
                                        ├── 暴露 Tools (execute)
                                        ├── 暴露 Resources (read)
                                        └── 暴露 Prompts (template)
```

### 两种传输方式

```
stdio（本地）：
  Agent ──spawn──→ MCP Server 进程
  stdio 作为通信管道

HTTP（远程）：
  Agent ──HTTP──→ MCP Server (远程服务)
```

### MCP 工具自动注册

```
opencode.json:
{
  "mcp": {
    "servers": [
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
      },
      {
        "name": "database",
        "url": "http://localhost:3001/mcp"
      }
    ]
  }
}
```

MCP Server 启动后，其暴露的 Tools 自动注册到 Agent 的工具注册表。Agent 看到的工具列表 = 内置 14 个 + MCP 提供的 N 个。

## 产出物

在 Stage 23 基础上：
- `mcp/mcp-client.ts` — MCP Client 实现
- `mcp/mcp-registry.ts` — MCP Server 注册与工具发现
- 集成到配置系统（opencode.json 的 mcp 段）
- 集成到工具注册表（MCP 工具与内置工具统一管理）

## 实现要点

- 实现 MCP 协议的基础部分：initialize、tools/list、tools/call
- stdio 传输：`child_process.spawn` + JSON 消息行协议
- HTTP 传输：SSE + JSON-RPC
- 启动时自动发现并注册 MCP 工具
- MCP 工具与内置工具在同一注册表中，LLM 无感知差异

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 MCP 集成有几个关键设计：

1. **MCP 工具与内置工具无缝融合**
   LLM 收到的工具定义列表中，内置工具和 MCP 工具没有区别。这是 OpenCode 设计哲学"一切皆工具"的体现。

2. **MCP Server 生命周期管理**
   ```
   启动: Agent 启动时，读取配置 → 启动 MCP Server 进程
   健康检查: 定期 ping MCP Server
   崩溃重启: MCP Server 崩溃后自动重启
   关闭: Agent 退出时 clean shutdown
   ```

3. **支持本地和远程**
   - 本地（stdio）：最常用，如 filesystem server、git server
   - 远程（HTTP）：企业场景，如 database server、API gateway

4. **工具命名空间隔离**
   如果 MCP Server 提供的工具名与内置工具冲突？OpenCode 用 `mcp/server-name/tool-name` 格式避免冲突。

### 对比其他 Agent

| Agent | MCP 支持 | 集成深度 | 特点 |
|-------|---------|---------|------|
| **OpenCode** | ✅ 完整支持（本地+远程） | 工具注册表融合 | 与内置工具无差别 |
| **Claude Code** | ❌（但 Claude API 有 MCP） | — | 通过 Claude Desktop |
| **Aider** | ❌ | — | — |
| **Cursor** | ❌ | — | — |

### 关键洞察

MCP 是 Agent 扩展性的"标准化协议层"。如果说内置工具是 Agent 的"基础手"，MCP 就是让 Agent 长出"新手指"的接口。

但 MCP 也有局限性：
- **工具描述的质量取决于 MCP Server 开发者**：不好的描述会让 LLM 不知道何时调用
- **MCP Server 崩溃会影响 Agent**：需要健壮的错误处理
- **安全问题**：MCP Server 可能执行危险操作（如 filesystem server 可能删除文件）

OpenCode 的做法很务实：把 MCP 工具和内置工具放在同一个注册表，用同样的权限系统管理。这让 MCP 工具继承了 OpenCode 已有的权限控制——不需要为 MCP 另搞一套。

**下一步**：MCP 扩展了工具。Stage 25 让用户能自定义工具。