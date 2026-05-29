# Stage 26 — Plugin 系统（事件驱动的行为扩展）

> **承上**：Stage 25 的自定义工具是"被调用的能力"，Plugin 是"主动响应的行为"
> **启下**：Plugin 系统让第三方可以深度集成 Agent 的各个生命周期

---

## 学习目标

1. 理解 Plugin 与 Tool 的本质区别——被动调用 vs 主动响应
2. 掌握事件驱动架构在 Agent 系统中的应用
3. 理解 20+ hook 点的设计——Agent 生命周期全覆盖

## 核心概念

### Tool vs Plugin

```
Tool:
  Agent 需要时才调用
  一次性的请求-响应
  例：read("file.ts"), bash("npm test")

Plugin:
  在每个关键事件点自动触发
  响应式的钩子
  例：在每次 LLM 调用前注入额外上下文
      在每次工具调用后审计日志
```

### Hook 点设计

```typescript
interface Plugin {
  name: string
  
  // Session 相关
  onSessionStart?(ctx: SessionContext): Promise<void>
  onSessionEnd?(ctx: SessionContext): Promise<void>
  
  // Message 相关
  onBeforeMessage?(ctx: MessageContext): Promise<Message | void>
  onAfterMessage?(ctx: MessageContext): Promise<void>
  
  // Tool 相关
  onBeforeToolCall?(ctx: ToolContext): Promise<ToolCall | void>
  onAfterToolCall?(ctx: ToolContext): Promise<void>
  
  // Agent 相关
  onAgentSwitch?(ctx: AgentContext): Promise<void>
  
  // 系统事件
  onCompaction?(ctx: CompactionContext): Promise<void>
  onError?(ctx: ErrorContext): Promise<void>
}
```

### Plugin 示例：审计日志

```typescript
// plugins/audit-logger.ts
const auditPlugin: Plugin = {
  name: "audit-logger",
  
  async onBeforeToolCall(ctx) {
    console.log(`[AUDIT] Agent ${ctx.agent} 调用 ${ctx.toolName}: ${JSON.stringify(ctx.args)}`)
  },
  
  async onAfterToolCall(ctx) {
    console.log(`[AUDIT] ${ctx.toolName} 完成: ${ctx.result}`)
  },
}
```

## 产出物

在 Stage 25 基础上：
- `plugin/plugin-system.ts` — Plugin 加载和执行引擎
- `plugin/plugin-context.ts` — Plugin 上下文定义
- 实现 6+ 核心 hook 点
- 示例 plugin：审计日志

## 实现要点

- Plugin 从配置的路径加载（`.opencode/plugins/`）
- 每个 hook 点按注册顺序依次执行所有 Plugin
- Hook 可以返回修改后的数据（如 `onBeforeMessage` 可以修改消息内容）
- Hook 执行失败不应阻断主流程（graceful degradation）

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 Plugin 系统有 **20+ hook 点**，覆盖 Agent 全生命周期：

1. **Hook 点分类**
   ```
   Session 级：
     onSessionStart, onSessionEnd, onSessionSwitch
   
   Message 级：
     onBeforeMessage, onAfterMessage
   
   Tool 级：
     onBeforeToolCall, onAfterToolCall, onToolResult
   
   Agent 级：
     onAgentStart, onAgentEnd, onAgentSwitch
   
   系统级：
     onCompaction, onError, onExit
   ```

2. **Plugin 上下文丰富**
   ```typescript
   interface PluginContext {
     session: SessionInfo       // 当前 session
     agent: AgentInfo           // 当前 agent
     db: Database               // 数据库访问
     sse: SSEBroadcaster        // 事件广播
     config: Config             // 配置访问
     logger: Logger             // 日志
   }
   ```

3. **Plugin 可以修改数据**
   `onBeforeMessage` 可以返回修改后的消息——这允许 Plugin 在消息发送给 LLM 之前注入额外上下文。

4. **Plugin 间通信**
   Plugin 可以通过 SSE Event Bus 广播自定义事件，其他 Plugin 可以订阅。

### 对比其他 Agent

| Agent | Plugin/Hook 系统 | 扩展深度 | 数据修改 |
|-------|-----------------|---------|---------|
| **OpenCode** | ✅ 20+ hook 点 | 极深 | ✅ 可修改消息 |
| **Claude Code** | ✅ 简单钩子 | 中 | ❌ |
| **Aider** | ❌ | — | — |
| **Cursor** | ❌ | — | — |

### 关键洞察

Plugin 系统设计的核心问题是：**hook 点放在哪？**

- 太少 → Plugin 能做的事有限，失去吸引力
- 太多 → 系统复杂度过高，性能影响大

OpenCode 的 20+ hook 点是一个"经过实践打磨"的数量：
- Session 事件（3 个）、Message 事件（4 个）、Tool 事件（6 个）、Agent 事件（3 个）、系统事件（4 个）——刚刚好覆盖了所有关键路径
- 每个 hook 点的位置都经过了"这里是否需要扩展点"的考量

Plugin 系统还有一个隐藏的价值：它让 OpenCode 团队自己能用 Plugin 形式试验新功能，不稳定的功能作为 Plugin 发布，成熟后再考虑内置。

**下一步**：Plugin 是行为扩展。Stage 27 实现 Skills 系统——知识扩展。