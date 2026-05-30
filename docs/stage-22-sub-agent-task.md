# Stage 22 — 子 Agent 与 Task 委派

> **承上**：Stage 21 实现了 2 个主 Agent，但仍是单 Agent 单 session
> **启下**：子 Agent 让主 Agent 能把复杂子任务委托出去，形成真正的团队协作

---

## 学习目标

1. 理解子 Agent 的创建、执行和结果汇合流程
2. 掌握 task 工具的实现——如何从主 Agent 创建子 Agent
3. 理解子 Agent 的消息隔离和上下文独立

## 核心概念

### 主 Agent → 子 Agent 委派

```
User: 请帮我重构整个 auth 模块

Build Agent（主）：
  1. grep "auth" → 找到 50 个文件
  2. 太复杂了，我需要帮助
  3. task(agent="general", prompt="分析所有 auth 文件的依赖关系")
     │
     ▼
  General Agent（子）：
    1. read src/auth/login.ts
    2. read src/auth/register.ts
    3. read src/auth/middleware.ts
    4. 分析依赖 → 生成依赖图
    5. 返回结果给主 Agent
     │
     ▼
  Build Agent（主）：
    收到子 Agent 结果 → 基于依赖图继续重构
```

### 子 Agent 的特性

```
1. 独立消息上下文 — 子 Agent 不继承主 Agent 的历史
2. 独立 session — 子 Agent 有自己的 session
3. 结果回传 — 子 Agent 完成后，结果作为 tool result 回传给主 Agent
4. 有限的工具集 — 子 Agent 有独立权限配置
```

### task 工具设计

```typescript
const taskTool = Tool.define({
  name: "task",
  description: "委托子任务给子 Agent 执行",
  inputSchema: z.object({
    agent: z.enum(["general", "explore"]).describe("子 Agent 类型"),
    prompt: z.string().describe("子任务的描述"),
    maxTurns: z.number().optional().describe("最大轮次"),
  }),
  async execute(args, ctx) {
    // 1. 创建子 Agent 的 session
    // 2. 运行子 Agent loop
    // 3. 返回子 Agent 的结果摘要
  }
})
```

## 产出物

在 Stage 21 基础上：
- `agent/sub-agent-executor.ts` — 子 Agent 执行器
- 修改 `tools/task.ts` — task 工具实现
- 扩展 `agent-definitions.ts` 增加 General 和 Explore
- 在 TUI 中标记子 Agent 的运行状态

## 实现要点

- 子 Agent session 有 `parent_session_id` 指向主 session
- 子 Agent 从独立消息开始（继承 task 描述，不继承主 Agent 历史）
- 子 Agent 完成后，结果作为 `tool-invocation` Part 插入主 session
- 子 Agent 可以嵌套（子 Agent 再调 task），但限制深度避免无限递归

---

## 技术洞察

### OpenCode 的做法

OpenCode 的子 Agent 系统是其架构中最精妙的部分：

1. **子 Agent Session 是主 Session 的分支**
   这正是 Stage 15 的 Session Branching 的应用场景：
   ```
   main-session  ──msg1──msg2──(task)──msg3
                                │
   sub-session    msg1──msg2──msg3   ← 独立的消息历史
   ```

2. **子 Agent 结果作为 agent Part**
   ```json
   {
     "type": "agent",
     "agentName": "general",
     "sessionID": "sub-session-123",
     "summary": "发现 auth 模块有 3 个循环依赖..."
   }
   ```
   在 TUI 中可以展开 `agent` Part 查看子 Agent 的完整对话。

3. **子 Agent 的权限继承**
   子 Agent 可以继承主 Agent 的权限，也可以配置独立的权限。

4. **子 Agent 的模型选择**
   Explore Agent（只读搜索）可以用便宜的模型，General Agent 可以用中等模型。

5. **Effect-TS 并发支持**
   OpenCode 用 Effect-TS 的 Fiber 支持并发子 Agent：
   ```typescript
   // 并行启动 3 个子 Agent
   const results = await Effect.all([
     subAgent("explore", "搜索 API 路由"),
     subAgent("explore", "搜索数据库 schema"),
     subAgent("explore", "搜索测试文件"),
   ])
   ```

### 对比其他 Agent

| Agent | 子 Agent | 并发 | 上下文隔离 |
|-------|---------|------|-----------|
| **OpenCode** | ✅ task 工具 + Session 分支 | ✅ Effect-TS Fiber | ✅ 独立 session |
| **Claude Code** | ⚠️ 有限（sub-agent 模式） | ❌ | ⚠️ |
| **Aider** | ❌ | ❌ | — |
| **Delegate (类似)** | ✅ 但实现不同 | ✅ | ✅ |

### 关键洞察

子 Agent 的价值不仅仅在"分工"。更深层的价值在于**上下文隔离**：

- 主 Agent 的对话历史可能已经很长了（5000+ tokens）
- 子 Agent 从零开始，只拿到 task 描述——上下文干净，推理质量更高
- 子 Agent 的结果以摘要形式回传——主 Agent 不需要看到所有细节

这个"clean context"模式是 Agent 系统的重要工程实践。在 Stage 28（上下文压缩）中，Compaction Agent 也利用了同样的原则：用独立的子 Agent 做压缩，不污染主 Agent 的上下文。

**下一步**：子 Agent 能搜索代码了，但不能真正"理解"代码。Stage 23 加入 LSP。