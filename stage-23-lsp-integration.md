# Stage 23 — LSP 集成

> **承上**：Agent 能读写文件，但靠纯文本"理解"代码
> **启下**：LSP 让 Agent 真正"懂得"代码结构，是编码 Agent 与普通 Agent 的分水岭

---

## 学习目标

1. 理解 Language Server Protocol (LSP) 的基本原理
2. 掌握如何启动和管理 LSP 进程
3. 理解 LSP 工具如何增强 Agent 的代码理解能力

## 核心概念

### 什么是 LSP

LSP 是 IDE（VS Code、Neovim 等）用来提供代码智能的协议：

```
IDE/Editor ──LSP Request──→ Language Server
  ├── "这个变量是什么类型？"    ├── typescript-language-server
  ├── "哪里调用了这个函数？"    ├── gopls (Go)
  ├── "这个文件有什么错误？"    ├── rust-analyzer
  └── "跳转到定义"            └── pyright (Python)
```

OpenCode 把这个能力给了 Agent。

### LSP 工具操作

```typescript
// Agent 可以调用的 LSP 操作
const lspTool = Tool.define({
  name: "lsp",
  description: "查询代码的语义信息",
  inputSchema: z.object({
    operation: z.enum([
      "goToDefinition",
      "findReferences",
      "hover",
      "documentSymbol",
      "workspaceSymbol",
      "callHierarchy",
    ]),
    filePath: z.string(),
    line: z.number(),
    character: z.number(),
  }),
  async execute(args) {
    const lspManager = getLspManager(args.filePath)
    return await lspManager.execute(args.operation, args)
  }
})
```

## 产出物

在 Stage 22 基础上：
- `lsp/lsp-manager.ts` — LSP 进程管理器
- `lsp/lsp-client.ts` — LSP 协议客户端
- `tools/lsp.ts` — LSP 工具
- 在 `tools/read.ts` 中附加 LSP 诊断信息

## 实现要点

- 使用 `vscode-languageserver` 或直接实现 JSON-RPC over stdio
- 根据文件扩展名自动选择合适的语言服务器
- LSP 进程懒启动和自动关闭
- `read` 工具的输出自动包含 diagnostic 信息（错误、警告）

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 LSP 集成是其代码理解的核心能力：

1. **30+ 预配置语言服务器**
   不是让用户自己配置（那是 IDE 的事），而是内置了 30+ 语言服务器的启动命令。

2. **LSP Manager 管理生命周期**
   ```
   LSP Manager
     ├── 检测文件类型 → 选择语言服务器
     ├── 启动语言服务器进程（懒加载）
     ├── 维护 WebSocket/stdio 连接
     ├── 处理请求队列
     └── 自动重启崩溃的服务器
   ```

3. **read 工具的 LSP 增强**
   这是 OpenCode 最精妙的设计之一：
   ```
   Agent 调用 read("src/main.ts")
     → 读取文件内容
     → 自动查询 LSP diagnostics
     → 返回：{ content: "...", diagnostics: [{ line: 10, message: "Type error", severity: "error" }] }
   ```
   **Agent 在"看一眼"的同时就"发现了问题"**——不需要额外调用 LSP 工具。

4. **LSP 结果作为 LLM 上下文**
   LSP 的诊断信息直接追加到 Agent 的上下文中，LLM 看到的是"代码 + 诊断"，能更准确地定位问题。

### 对比其他 Agent

| Agent | LSP 集成 | 范围 | 增强方式 |
|-------|---------|------|---------|
| **OpenCode** | ✅ 内置 30+ 语言服务器 | read 增强 + lsp 工具 | 自动诊断 |
| **Claude Code** | ❌ 无 LSP | — | — |
| **Aider** | ⚠️ lsp 命令（手动） | 手动触发 | — |
| **Cursor** | ✅ 完整的 LSP 支持 | IDE 原生 | 全自动 |
| **GitHub Copilot** | ✅ LSP + 语义索引 | IDE 原生 | 全自动 |

### 关键洞察

LSP 集成让 Agent 从"文本匹配"升级到"语义理解"：

- 没有 LSP：Agent 靠函数名猜测"这个函数可能在哪定义的"——可能猜错
- 有 LSP：Agent 精确知道每个符号的定义位置、引用位置、类型信息——准确可靠

OpenCode 把 LSP 结果注入到 `read` 工具的输出中——这是一个非常聪明的设计选择：
- 如果 LSP 是独立工具，Agent 需要学会"先读文件，再查 LSP"
- 但 OpenCode 让 `read` 自动附带诊断，Agent 不需要额外学习——**好设计让正确的事变成默认的事**

**下一步**：LSP 让 Agent 理解了代码。Stage 24 通过 MCP 扩展 Agent 的能力边界。