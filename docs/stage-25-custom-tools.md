# Stage 25 — 自定义工具（Custom Tools）

> **承上**：Stage 24 通过 MCP 扩展了工具，但需要写 MCP Server
> **启下**：自定义工具门槛更低，让用户能在项目中直接定义工具

---

## 学习目标

1. 理解自定义工具的注册和执行机制
2. 掌握目录扫描和动态加载 TypeScript 模块
3. 理解自定义工具如何覆盖内置工具

## 核心概念

### 工具定义方式对比

```
内置工具：
  写在 Agent 源码中，编译进二进制

MCP 工具：
  独立进程，通过 MCP 协议调用

自定义工具：
  放在项目 .opencode/tools/ 目录，TypeScript 文件
  被 Agent 动态加载，融入工具注册表
```

### 自定义工具示例

```typescript
// .opencode/tools/deploy.ts
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "部署应用到 staging 环境",
  args: {
    environment: tool.schema.string().describe("目标环境"),
    version: tool.schema.string().optional().describe("版本号"),
  },
  async execute(args) {
    // 调用部署脚本
    const result = await deploy(args.environment, args.version)
    return `部署完成: ${result.url}`
  },
})
```

### 工具加载流程

```
Agent 启动
  → 扫描 .opencode/tools/
  → 动态 import 每个 .ts 文件
  → 注册到工具注册表
  → 如果与内置工具同名，覆盖内置版本
```

## 产出物

在 Stage 24 基础上：
- `tools/custom-tool-loader.ts` — 自定义工具动态加载器
- 修改 `tool-registry.ts` 支持运行时注册和覆盖
- 创建示例自定义工具（如 `deploy.ts`, `slack-notify.ts`）

## 实现要点

- 使用 `import()` 动态加载 TypeScript 文件
- 工具文件约定：default export `Tool.define({...})`
- 文件名为工具名（`deploy.ts` → tool name: `deploy`）
- 自定义工具与内置工具同名时，自定义工具优先（覆盖）

---

## 技术洞察

### OpenCode 的做法

OpenCode 的自定义工具体现了"约定优于配置"的理念：

1. **目录约定**
   所有 `.opencode/tools/*.ts` 自动成为工具，不需要额外配置。

2. **与内置工具同 registry**
   自定义工具和内置工具在同一个 `ToolRegistry` 中，LLM 看到的工具列表是合并后的。

3. **覆盖机制**
   如果你不喜欢 OpenCode 的 `edit` 实现，在 `.opencode/tools/edit.ts` 写一个新的——自动覆盖内置版本。

4. **插件 SDK**
   ```typescript
   import { tool } from "@opencode-ai/plugin"
   
   export default tool({
     description: "...",
     args: { ... },
     async execute(args) {
       // 可以访问：
       // - 文件系统
       // - Agent context (session, agent info)
       // - 数据库
       // - HTTP client
     }
   })
   ```

### 对比其他 Agent

| Agent | 自定义工具 | 加载方式 | 覆盖支持 |
|-------|----------|---------|---------|
| **OpenCode** | ✅ .opencode/tools/*.ts | 目录扫描 + 动态 import | ✅ 可覆盖内置 |
| **Claude Code** | ✅ 自定义钩子 | 配置文件指定 | ❌ |
| **Aider** | ✅ 自定义命令 | 命令别名 | ❌ |
| **LangChain** | ✅ 自定义 Tool 子类 | 代码中注册 | ❌ |

### 关键洞察

OpenCode 的自定义工具设计有几个很聪明的点：

1. **"文件即工具"** — 不需要写配置文件声明，放对目录就行
2. **TypeScript 原生** — 不需要学 DSL 或 JSON schema，用熟悉的语言
3. **覆盖机制** — 工具是可以被"换掉"的，这是插件化思维的最高境界

这三点加起来让自定义工具的门槛极低：开发者只需要写一个 TypeScript 文件，放在正确目录——不需要任何配置。

**下一步**：自定义工具是静态的。Stage 26 实现 Plugin 系统（事件驱动的行为扩展）。