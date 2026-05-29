# OpenCode 架构设计文档

> AI Coding Agent 学习项目 — 从调研开源项目 opencode 到从 0 到 1 逐步演进

---

## 一、OpenCode 概述

OpenCode 是由 [Anomaly](https://anoma.ly/) 团队打造的**开源 AI 编程 Agent**（MIT 协议），截至 2026 年 5 月已获 15w+ GitHub Stars，拥有 460+ 贡献者、11000+ commits。

核心定位：**不绑定任何单一 LLM 提供商、代码 100% 开源、完全可扩展的 AI 编程助手**。

### 三大设计抉择

| 抉择 | 说明 |
|------|------|
| **开源可控** | MIT 协议，核心逻辑完全透明，可审计、可修改、可分发 |
| **LLM 不绑定** | 支持 75+ providers，用户自由切换模型而不必更换工具链 |
| **Client/Server 分离** | 前端只是客户端之一，API 驱动一切，支持 TUI / Web / Desktop / IDE |

### 产品形态

- **TUI**（Terminal User Interface）：基于自研框架 OpenTUI 的终端界面
- **Web UI**：基于 React 的浏览器界面
- **Desktop**：基于 Tauri 的桌面应用
- **IDE 扩展**：VS Code 插件
- **Headless Server**：通过 `opencode serve` 启动纯服务端模式

---

## 二、技术栈总览

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **运行时** | Bun | 高性能 JavaScript 运行时，替代 Node.js |
| **服务端框架** | Hono | 轻量 HTTP 框架，OpenAPI 3.1 规范 |
| **数据库 ORM** | Drizzle ORM + SQLite | 每个项目独立的本地数据库 |
| **AI SDK** | Vercel AI SDK | 统一的 LLM 流式调用抽象 |
| **Schema 校验** | Zod | 工具输入参数校验 |
| **TUI 引擎** | OpenTUI（Zig + SolidJS） | 自研 60 FPS 终端渲染框架 |
| **TUI 底层** | Zig（Rope 缓冲、帧差分、ANSI 生成） | 性能关键路径用原生语言 |
| **桌面应用** | Tauri | 跨平台桌面壳 |
| **LSP** | 内置 30+ 语言服务器 | 向量化代码理解 |
| **构建** | Bun compile | 编译为原生二进制 |

---

## 三、核心架构：Client/Server 分离

### 3.1 架构全景

```
┌──────────────────────────────────────────────────────┐
│                    Client Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐        │
│  │   TUI    │  │  Web UI  │  │ Desktop(Tauri)│        │
│  │ (OpenTUI)│  │  (React) │  │              │        │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘        │
└───────┼──────────────┼───────────────┼────────────────┘
        │              │               │
        └──────────────┴───────────────┘
                       │  HTTP/SSE
┌──────────────────────┼───────────────────────────────┐
│                  Server Layer                          │
│  ┌─────────────────────────────────────────────────┐  │
│  │           Hono HTTP Server (OpenAPI 3.1)         │  │
│  │  ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ │  │
│  │  │ Agent  │ │   LSP    │ │Provider│ │Session │ │  │
│  │  │ Engine │ │  Manager │ │ Router │ │Manager │ │  │
│  │  └────────┘ └──────────┘ └────────┘ └────────┘ │  │
│  └─────────────────────────────────────────────────┘  │
│                       │                                │
│  ┌────────────────────┴────────────────────────────┐  │
│  │            SQLite (Drizzle ORM)                   │  │
│  │  每个项目独立 DB: ~/.local/share/opencode/       │  │
│  │  project/<hash>/data.db                           │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### 3.2 关键设计决策

**为什么用 Client/Server 分离？**

1. **多客户端共享**：TUI / Web / Desktop / IDE / 手机 App 都能连接同一个 Server
2. **Headless 模式**：`opencode serve` 启动纯服务端，适合 CI/CD 和自动化场景
3. **项目级隔离**：每个项目有独立的 SQLite 数据库（`~/.local/share/opencode/project/<hash>/data.db`）
4. **实时同步**：SSE（Server-Sent Events）端点 `/global/event` 让所有客户端实时接收流式输出
5. **API 优先**：OpenAPI 3.1 规范的 REST API，文档端点 `/doc`

### 3.3 与其他 Agent 的架构对比

| 维度 | OpenCode | Claude Code | Aider | Cursor |
|------|----------|-------------|-------|--------|
| **架构模式** | Client/Server HTTP | 单体 CLI | 单体 CLI | IDE 内嵌 |
| **多客户端** | ✅ TUI/Web/Desktop/IDE | ❌ 仅 TUI | ❌ 仅 CLI | ❌ 仅 IDE |
| **Headless** | ✅ `opencode serve` | ❌ | ❌ | ❌ |
| **API 开放** | ✅ OpenAPI 3.1 | ❌ 无 | ❌ 无 | ❌ 无 |
| **项目隔离** | ✅ 每项目独立 DB | — | — | N/A |
| **实时同步** | SSE 广播 | TUI 内置 | 终端直接输出 | 插件内部 |

---

## 四、Agent 核心系统

### 4.1 Agent 循环（Agent Loop）

Agent 循环是 OpenCode 的心脏，实现为 `SessionPrompt.loop()`：

```
用户输入
    │
    ▼
┌─────────────────────────────────────┐
│ 1. 构建用户消息                       │
│    - 附加文件上下文                    │
│    - 附加元数据                       │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 2. 工具注册表解析                     │
│    - 构建 AI SDK 工具定义             │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 3. 提醒插入                          │
│    - 队列中的系统消息注入              │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│ 4. LLM 流式调用                      │
│    - SessionProcessor 处理            │
│    - Provider 适配                   │
└──────────────┬──────────────────────┘
               ▼
        finish_reason?
        /          \
   tool-calls     stop/end_turn
       │               │
       ▼               ▼
┌──────────────┐  ┌──────────────┐
│ 5. 工具执行   │  │  6. 返回结果  │
│ - 权限检查   │  │  响应记录     │
│ - 插件Hook  │  │  DB持久化    │
│ - 执行      │  └──────────────┘
└──────┬───────┘
       │
       └──────→ 返回步骤 1（循环继续）
```

### 4.2 消息处理管道（Message Pipeline）

在 LLM 调用前，消息经过 5 个步骤的处理管道：

| 步骤 | 处理 | 说明 |
|------|------|------|
| `MessageV2.toModelMessages()` | 内部格式 → AI SDK 格式 | 多态 Part 转统一格式 |
| `ProviderTransform.message()` | 提供商特定转换 | Anthropic 去空内容、Mistral ID 归一化 |
| `ProviderTransform.options()` | 模型参数设置 | maxTokens, temperature, topP |
| `ProviderTransform.applyCaching()` | 缓存控制头 | Anthropic/Bedrock/OpenRouter |
| `LLM.stream()` | 流式调用 | 带错误恢复和重试 |

### 4.3 多态 Part 系统

消息由类型化 `Part` 对象数组构成，是扩展性的关键设计：

```typescript
type Part =
  | { type: "text"; content: string }
  | { type: "tool-invocation"; toolName: string; args: Record<string, unknown>; result: ToolResult }
  | { type: "reasoning"; content: string }
  | { type: "file"; path: string; content: string }
  | { type: "image"; data: Buffer; mimeType: string }
  | { type: "agent"; agentName: string; sessionID: string }
```

每个 Part 有独立的 schema 和渲染逻辑，新增内容类型不影响现有 Part。

### 4.4 多 Agent 两阶架构

OpenCode 采用**主 Agent + 子 Agent** 的两级架构：

| 类型 | Agent | 权限 | 用途 |
|------|-------|------|------|
| **主 Agent** | `Build` | 全工具访问 | 默认开发 Agent，文件读写、命令执行 |
| 主 Agent | `Plan` | 只读（无 write/edit/bash） | 安全分析、架构设计 |
| **子 Agent** | `General` | 全访问（无 todo） | 复杂搜索的委派目标 |
| 子 Agent | `Explore` | 只读 | 代码库探索 |
| 隐藏 | `Compaction` | — | 上下文压缩 |
| 隐藏 | `Title` | — | 会话命名 |

**切换方式**：Tab 键切换主 Agent，子 Agent 通过 `task` 工具自动调用。

### 4.5 Agent 调度原理

- 主 Agent 是用户的直接交互对象
- 当任务复杂度超出阈值，主 Agent 通过 `task` 工具创建子 Agent 并委派子任务
- 子 Agent 拥有独立的消息上下文，不污染主 Agent 的对话历史
- 子 Agent 完成后将结果摘要回传给主 Agent

---

## 五、Tool（工具）系统

### 5.1 内置工具（14 个）

| 分类 | 工具 | 功能 | 实现特点 |
|------|------|------|---------|
| **文件操作** | `read` | 读取文件 | 输出包含 LSP 诊断信息 |
| | `write` | 创建/覆盖文件 | 全文替换 |
| | `edit` | 部分编辑 | 基于搜索替换的差分编辑 |
| | `patch` | 打补丁 | diff 格式批量修改 |
| **搜索** | `grep` | 文本搜索 | 内部调用 ripgrep，尊重 .gitignore |
| | `glob` | 文件名匹配 | 按修改时间排序 |
| | `list` | 目录列表 | 树形显示 |
| **执行** | `bash` | Shell 执行 | 在伪终端中执行 |
| | `task` | 子 Agent 委派 | 启动子 Agent |
| **知识** | `skill` | 技能加载 | 按需上下文注入 |
| | `webfetch` | 网页抓取 | 页面获取与解析 |
| | `websearch` | 网页搜索 | 通过 Tavily API |
| | `lsp` | 代码智能 | 类型、符号、诊断 |
| **交互** | `question` | 用户提问 | 阻塞等待用户响应 |

### 5.2 工具定义模式

使用 `Tool.define()` + Zod schema 定义：

```typescript
const readTool = Tool.define({
  name: "read",
  description: "读取文件内容",
  inputSchema: z.object({
    file_path: z.string().describe("文件路径"),
    offset: z.number().optional().describe("起始行"),
    limit: z.number().optional().describe("读取行数"),
  }),
  async execute(args, ctx) {
    const content = await readFile(args.file_path, args.offset, args.limit)
    const diagnostics = await getLspDiagnostics(args.file_path)
    return { content, diagnostics }
  },
})
```

**Tool.Context** 包含：sessionID、messageID、agentName、abortSignal、permissionCheck。

### 5.3 工具执行管道（6 阶段）

```
Part 状态: pending → executing → completed | error
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
  权限确认   插件 Hook    工具执行
```

状态变更通过 SSE 实时广播给所有客户端。

### 5.4 自定义工具

在 `.opencode/tools/` 目录放置 TypeScript 文件即可：

```typescript
// .opencode/tools/deploy.ts
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "部署到 staging 环境",
  args: {
    environment: tool.schema.string().describe("目标环境"),
  },
  async execute(args) {
    return `部署 ${args.environment} 完成`
  },
})
```

同名文件可覆盖内置工具。

---

## 六、Provider 抽象层

### 6.1 设计目标

让 Agent 核心与 LLM 提供商完全解耦，支持 75+ providers 的统一访问。

### 6.2 提供商解析链

按优先级从高到低解析模型选择：

1. 任务级配置（显式指定）
2. Agent 级配置（agent 定义中的 model）
3. 项目级配置（`opencode.json` 的 provider 段）
4. 全局配置（用户全局默认）
5. Models.dev 数据库（默认配置）

认证信息解析也是层级化：

| 优先级 | 来源 | 示例 |
|--------|------|------|
| 1（最高） | 环境变量 | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` |
| 2 | 认证文件 | `~/.local/share/opencode/auth.json` |
| 3 | 配置文件 | `opencode.json` 的 `provider` 段 |
| 4 | Models.dev DB | 默认配置 |

### 6.3 ProviderTransform：差异吸收层

每个 Provider 的 API 有细微差异，通过 `ProviderTransform` 统一处理：

```typescript
namespace ProviderTransform {
  // Anthropic: 去掉空 content（防止 API 报错）
  // Mistral: tool call ID 规范化为 9 位字母数字
  // OpenAI: 无需特殊处理

  function message(provider: string, messages: Message[]): Message[]

  // Anthropic/Bedrock/OpenRouter: 附加缓存控制头
  function applyCaching(provider: string, messages: Message[]): Message[]
}
```

核心原则：**Provider 差异完全隔离在 Agent Loop 之外**。

### 6.4 与 AI SDK 的关系

OpenCode 基于 Vercel AI SDK 构建 Provider 层：
- AI SDK 提供 `generateText()` / `streamText()` 统一接口
- OpenCode 在此基础上添加：ProviderTransform、认证管理、模型路由

### 6.5 与其他 Agent 的 Provider 方案对比

| 方案 | OpenCode | Claude Code | Aider | LangChain |
|------|----------|-------------|-------|-----------|
| **绑定模型** | 无绑定，75+ | 仅 Claude | 多模型支持 | 多模型支持 |
| **抽象层** | AI SDK + 自研 Transform | 无（直接调 API） | LiteLLM | LangChain 标准 |
| **多 Provider 同时** | ✅ 不同 Agent 不同模型 | ❌ | ❌ | ✅ |
| **认证管理** | 4 层级联 | 环境变量 | 环境变量 | 多种方式 |
| **厂商差异处理** | ProviderTransform 隔离 | 无需 | 各模型适配器 | BaseLLM 子类 |

---

## 七、TUI 终端界面（OpenTUI）

### 7.1 设计动机

OpenCode 没有使用现有的 TUI 框架（React 的 Ink、Go 的 Bubbletea），而是自研 **OpenTUI**，原因是要实现 **60 FPS 的终端渲染**——同时处理 LLM 流式输出、滚动、语法高亮、差异显示。

### 7.2 Zig + TypeScript 两层架构

```
┌────────────────────────────────────┐
│  TypeScript 层（Bun）               │
│  - SolidJS 组件与响应性             │
│  - Hono HTTP 客户端                │
│  - 布局计算（Yoga Layout）          │
│  - 组件渲染管线                     │
├────────────────────────────────────┤
│  Zig 层（Native FFI）               │
│  - Rope 缓冲（O(log n) 插入/删除）  │
│  - 帧差分（变更检测）               │
│  - ANSI 转义生成（RLE 压缩）        │
│  - 6 平台变体（OS × arch）          │
└────────────────────────────────────┘
```

**Zig 核心** 负责性能关键路径：
- **帧差分**：比较前后帧的 cell 数组，只输出变更部分
- **ANSI 生成**：同一 style 的 cell 用游程编码压缩，最小化输出字节
- **Rope 缓冲**：大文本 O(log n) 编辑

**TypeScript 绑定** 通过 Bun 的 `dlopen()` FFI 加载 Zig 二进制。

### 7.3 SolidJS 调和器（Reconciler）

使用 `solid-js/universal` 的 `createRenderer` 将 SolidJS 的细粒度响应性接入终端渲染：

- SolidJS 编译时 JSX 转为 `createElement`/`insertNode`/`setProperty` 调用
- **无虚拟 DOM**，直接操作终端 cell 矩阵
- `componentCatalogue` 映射 JSX 标签到 `Renderable` 构造器

### 7.4 核心 Renderable 组件

| 组件 | 用途 |
|------|------|
| `BoxRenderable` | 边框、背景、标题布局容器 |
| `TextRenderable` | 样式化文本显示 |
| `EditBufferRenderable` | 光标、Undo/Redo 多行编辑器 |
| `CodeRenderable` | Tree-sitter 语法高亮 |
| `DiffRenderable` | 统一/分割 diff 显示 |
| `ScrollBoxRenderable` | 自定义加速滚动的滚动区域 |

### 7.5 渲染管线

```
JSX Render → Yoga 布局计算 → 组件 render(buffer)
    → 命中网格映射 → Zig 帧差分 → Zig ANSI 生成
    → stdout → 缓冲区交换
```

### 7.6 与其他 TUI 方案的对比

| 方案 | OpenTUI (OpenCode) | Ink (React) | Bubbletea (Go) |
|------|-------------------|-------------|----------------|
| **渲染模型** | Zig 原生 + SolidJS 声明式 | React 声明式 | Elm 架构 |
| **帧率** | 60 FPS（亚毫秒帧时间） | 中等 | 中等 |
| **语法高亮** | Tree-sitter | 依赖第三方 | 依赖第三方 |
| **流式更新** | 帧差分增量更新 | 全量重渲染 | 增量更新 |
| **语言** | Zig + TypeScript | TypeScript | Go |
| **虚拟 DOM** | 无（直接 cell 矩阵） | 有 | 无 |

---

## 八、Session（会话）管理

### 8.1 会话模型

OpenCode 的 session 是**对话即状态**（Conversation as State）模型：

- 每个 session 包含完整的消息历史（Part 数组）
- Session 保存在 SQLite 中（Drizzle ORM）
- 支持 session 分支（branching）——从一个对话分叉出多条路径

### 8.2 Session 分支

用户可以回溯到历史某个点创建分支，类似 Git 分支概念：
- 主分支继续原有对话
- 新分支从分叉点开始新的对话方向
- 每条分支有独立的消息历史

大部分 AI Agent 没有这项功能（Claude Code 和 Aider 均不支持）。

### 8.3 Database.effect 模式

OpenCode 使用了函数式的 **Database.effect** 模式管理 SQLite 操作：
- 将数据库操作包装为 Effect（Effect-TS 的 Effect 类型）
- 所有副作用可追踪、可组合、可测试
- 支持事务、错误恢复、并发控制

### 8.4 数据库 Schema（核心表）

```
sessions
  - id: string
  - title: string
  - created_at: timestamp
  - agent_name: string
  - parent_session_id: string (nullable, 用于分支)

messages
  - id: string
  - session_id: string (FK)
  - role: string (user | assistant | system)
  - parts: json (Part 数组)
  - created_at: timestamp

permissions
  - id: string
  - session_id: string (FK)
  - tool_name: string
  - pattern: string (glob)
  - action: string (allow | deny | ask)
```

---

## 九、权限系统

### 9.1 三层权限模型

```
┌─────────────────────────────┐
│  会话级权限 (Session Level)  │ ← 最高优先级
├─────────────────────────────┤
│  Agent 级权限                 │
├─────────────────────────────┤
│  全局配置权限                 │ ← 最低优先级
└─────────────────────────────┘
```

### 9.2 权限规则

每条规则包含：
- **tool_name**：适用的工具名
- **pattern**：glob 模式（如 `*.env`、`rm -rf *`）
- **action**：`allow` | `deny` | `ask`

```json
{
  "permission": {
    "read": {
      ".env": "deny",
      "**": "allow"
    },
    "bash": {
      "rm -rf *": "deny",
      "git *": "allow",
      "**": "ask"
    },
    "edit": { "**": "allow" }
  }
}
```

匹配规则：
1. 从高优先级开始扫描
2. **最后匹配的 glob 模式生效**（后覆盖前）
3. 已批准的操作写入 DB 持久化，避免重复询问

### 9.3 权限系统对比

| Agent | 权限模型 | 粒度 | 持久化 |
|-------|---------|------|--------|
| **OpenCode** | 3 层 + glob + allow/deny/ask | 工具 × glob 模式 | ✅ |
| **Claude Code** | 全局 allow/deny | 工具级 | ✅ |
| **Aider** | YOLO/Auto/Ask | 操作级 | ❌ |
| **Cursor** | 工具级确认 | 工具级 | — |

---

## 十、LSP 集成

### 10.1 为什么 Agent 需要 LSP

纯文本阅读不能真正"理解"代码。LSP 提供：
- 函数定义在哪？
- 哪里调用了这个函数？
- 变量类型是什么？
- 文件中有哪些错误/警告？

### 10.2 LSP 架构

```
Agent ←→ lsp tool ←→ LSP Manager ←→ Language Servers (30+)
                                ├── typescript-language-server
                                ├── gopls
                                ├── rust-analyzer
                                ├── pyright
                                └── ...
```

### 10.3 LSP 工具操作

| 操作 | 说明 | 用途 |
|------|------|------|
| `goToDefinition` | 跳转到定义 | 定位函数/类实现 |
| `findReferences` | 查找引用 | 评估变更影响范围 |
| `hover` | 悬停信息 | 获取类型和文档 |
| `documentSymbol` | 文档符号 | 了解文件结构 |
| `workspaceSymbol` | 工作区符号 | 项目级符号搜索 |
| `callHierarchy` | 调用层次 | 跟踪调用链 |

### 10.4 read 工具的 LSP 增强

`read` 工具读取文件时，**自动附加 LSP 诊断信息**——让 Agent 一次工具调用同时获取代码内容和问题。

---

## 十一、MCP（Model Context Protocol）集成

### 11.1 MCP 是什么

MCP 是 Anthropic 推出的开放协议，用于标准化 LLM 与外部工具/数据源之间的交互。

### 11.2 OpenCode 的 MCP 集成

```
OpenCode Server
    │
    ├── MCP Client ──── MCP Server (本地进程)
    │                       ├── filesystem
    │                       ├── git
    │                       └── custom
    │
    ├── MCP Client ──── MCP Server (远程 HTTP)
    │                       ├── database
    │                       └── API services
    │
    └── Tool Registry ← MCP tools 自动注册
```

- MCP Server 的工具自动注册到 OpenCode 的工具注册表
- 支持本地（stdio）和远程（HTTP）两种传输
- LLM 看到的工具列表中，内置工具和 MCP 工具无差别

---

## 十二、Skills & Plugins 系统

### 12.1 Skills 系统

Skills 是**按需加载的知识包**：
- Agent 通过 `skill` 工具激活 skill
- Skill 内容作为系统消息注入到上下文
- 按需加载，不占用固定 token 预算

### 12.2 Plugins 系统

Plugins 是**事件驱动的行为扩展**：

```typescript
// Plugin 生命周期
interface Plugin {
  name: string
  // 20+ 钩子点
  onSessionStart?(ctx: SessionContext): Promise<void>
  onMessage?(ctx: MessageContext): Promise<void>
  onToolCall?(ctx: ToolContext): Promise<void>
  onToolResult?(ctx: ToolContext): Promise<void>
  onCompaction?(ctx: CompactionContext): Promise<void>
  // ...
}
```

**20+ 钩子点**覆盖 Agent 全生命周期：
- Session 事件：创建、切换、结束
- Message 事件：发送前、接收后
- Tool 事件：调用前、执行中、完成后
- 系统事件：compaction、error、exit

### 12.3 Plugin 上下文

每个钩子接收的 context 包含：
- Session 信息
- 当前 Agent 信息
- 数据库访问接口
- SSE 广播接口
- 配置访问接口

---

## 十三、上下文管理（Context Engineering）

### 13.1 三阶段上下文管理

当 token 使用量接近模型上限时，OpenCode 执行三级管理：

| 阶段 | 操作 | 触发条件 | 效果 |
|------|------|---------|------|
| **1. Pruning** | 删除冗余内容 | Token 达到阈值 | 移除重复/无用消息 |
| **2. Compaction** | LLM 压缩摘要 | Pruning 不足 | 用压缩后的摘要替换历史 |
| **3. Replacement** | 替换整段上下文 | Compaction 仍不足 | 系统性重建上下文 |

### 13.2 Compaction Agent

`Compaction` Agent（隐藏 Agent）专门负责上下文压缩：
- 读取对话历史
- 生成结构化摘要（保留关键决策、未完成事项、当前状态）
- 用摘要替换原始历史

### 13.3 与 Claude Code / Aider 的上下文对比

| Agent | 上下文策略 | 压缩方式 | Token 预算管理 |
|-------|-----------|---------|---------------|
| **OpenCode** | 3 阶段自适应 | LLM 自动压缩 + 结构化摘要 | 动态阈值 |
| **Claude Code** | 滚动窗口 + truncation | 简单截断 | 固定限制 |
| **Aider** | Map-Reduce 风格 | 编辑历史压缩 | 基于树的 map |
| **Cursor** | 按文件相关性排序 | 不压缩 | 裁剪策略 |

---

## 十四、配置系统

### 14.1 5 层配置级联

配置按优先级从高到低合并：

```
1. 命令行参数 (--model, --agent, ...)
     ↓ 覆盖
2. 环境变量 (OPENCODE_*)
     ↓ 覆盖
3. 项目配置 (./opencode.json)
     ↓ 覆盖
4. 用户配置 (~/.config/opencode/config.json)
     ↓ 覆盖
5. 内置默认值
```

### 14.2 opencode.json 结构

```json
{
  "model": "anthropic/claude-sonnet",
  "agent": "build",
  "permission": { /* ... */ },
  "provider": {
    "anthropic": {
      "models": {
        "claude-sonnet": { "name": "Claude Sonnet" }
      }
    }
  },
  "lsp": {
    "typescript": { "enabled": true }
  },
  "mcp": {
    "servers": [
      { "name": "filesystem", "command": "npx", "args": ["-y", "@anthropic/mcp-filesystem"] }
    ]
  },
  "plugins": ["omo"],
  "tools": {
    "custom": ["./tools/deploy.ts"]
  }
}
```

---

## 十五、CLI 入口

### 15.1 启动流程

```typescript
// 简化的启动流程
async function main() {
  // 1. 解析命令行参数
  const args = parseArgs(process.argv)

  // 2. 加载配置（5 层级联）
  const config = await loadConfig(args)

  // 3. 初始化 SQLite（项目级隔离）
  const db = await initDatabase(config.projectDir)

  // 4. 启动 HTTP Server（Hono）
  const server = await startServer({ port: config.port, db, config })

  // 5. 启动客户端（TUI / Web / Desktop）
  if (args.headless) {
    console.log(`Server running at http://localhost:${config.port}`)
  } else if (args.web) {
    await startWebClient(server)
  } else {
    await startTUIClient(server) // 默认 TUI
  }
}
```

### 15.2 CLI 命令概览

```
opencode                 # 启动 TUI
opencode serve           # Headless 模式（仅 Server）
opencode web             # 启动 Web UI
opencode --model <id>    # 指定模型
opencode --agent <name>  # 指定 Agent
opencode --help          # 帮助
```

---

## 十六、Effect-TS 深度集成

### 16.1 为什么用 Effect-TS

Effect-TS 是 TypeScript 的代数效应库，提供：

1. **类型安全的副作用**：所有 IO 操作都在 Effect 类型中表达
2. **可组合性**：Effect 可组合、可变换、可链式调用
3. **错误跟踪**：错误类型是 Effect 签名的一部分
4. **依赖注入**：通过 Context/Service 模式管理依赖
5. **并发控制**：Fiber-based 并发、结构化并发

### 16.2 在 OpenCode 中的应用

- **工具执行**：每个工具的 execute 是 `Effect<Requirements, Error, Output>`
- **数据库操作**：Database.effect 模式
- **子进程管理**：Effect-TS ChildProcess 的流式 Shell
- **重试逻辑**：Effect.retry / Effect.schedule
- **并发 Agent**：Effect.forkAll 并行启动多个子 Agent

---

## 十七、构建与分发

### 17.1 Bun Compile

```
TypeScript 源码
    │
    ▼
Bun compile ──→ 原生二进制（macOS/Linux/Windows × arm64/x64）
```

- Bun 将 TypeScript + Zig FFI 编译为**单文件原生二进制**
- 零依赖分发（无需安装 Node.js/Bun）
- 支持 goreleaser 风格的 release 管道

### 17.2 发布流程

```
GitHub Actions
  ├── Lint & Test
  ├── Bun compile (6 targets)
  ├── Generate OpenAPI schema
  ├── Publish to npm
  ├── Publish to Homebrew (anomalyco/tap)
  └── Create GitHub Release
```

---

## 十八、设计哲学总结

| 原则 | 体现 |
|------|------|
| **控制权归用户** | MIT 开源、本地执行、数据不离开机器 |
| **Provider 不可知** | 75+ providers，统一抽象层 |
| **Client/Server 分离** | API 驱动、多客户端、Headless |
| **分层可插拔** | Tools、Skills、Plugins、MCP 独立扩展 |
| **性能优先** | Zig 原生 TUI、Rope 缓冲、帧差分 |
| **类型安全** | TypeScript + Effect-TS + Zod schema |
| **安全可控** | 3 层权限模型 + glob 匹配 + 持久化 |
| **上下文工程** | 3 阶段自适应压缩 |

---

## 十九、与其他主流 Agent 的全景对比

| 维度 | OpenCode | Claude Code | Aider | Cursor | GitHub Copilot |
|------|----------|-------------|-------|--------|---------------|
| **开源** | ✅ MIT | ❌ | ✅ Apache 2.0 | ❌ | ❌ |
| **架构** | Client/Server | 单体 TUI | 单体 CLI | IDE 插件 | IDE 插件 |
| **Provider** | 75+ | Claude only | 多模型 | 多模型 | OpenAI only |
| **TUI** | 自研 OpenTUI (60FPS) | Bubbletea | ASCII 输出 | 无（IDE） | 无（IDE） |
| **LSP 集成** | ✅ 内置 30+ | ❌ | ✅ lsp 命令 | ✅ 自带 | ✅ 自带 |
| **MCP 支持** | ✅ 完整 | ❌ | ❌ | ❌ | ❌ |
| **权限模型** | 3 层 + glob | 全局 | YOLO/Auto/Ask | 工具确认 | 无 |
| **会话分支** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **插件系统** | 20+ Hook | 简单钩子 | 自定义命令 | 无 | 无 |
| **上下文压缩** | 3 阶段自适应 | 截断 | Map-Reduce | 相关性排序 | 相关性排序 |
| **Headless** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Web UI** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Desktop** | ✅ Tauri | ❌ | ❌ | ✅ | ❌ |