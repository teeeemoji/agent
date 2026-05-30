# Stage 21 — 多 Agent 系统（Build + Plan）

> **承上**：前 20 个 Stage 只有一个 Agent 角色（默认 Build）
> **启下**：多 Agent 让系统从"一个 AI"变成"一个团队"，是 OpenCode 区别于大多数 Agent 的核心特征

---

## 学习目标

1. 理解多 Agent 的设计——不同角色、不同权限、不同 system prompt
2. 掌握 Agent 注册和切换机制
3. 理解"Plan then Build"工作流的价值

## 核心概念

### Agent 定义

```typescript
interface AgentDefinition {
  name: string           // "build" | "plan"
  description: string    // "代码构建和执行"
  systemPrompt: string   // 动态构建的系统提示词
  allowedTools: string[] // ["read", "write", "edit", "bash", ...]
  model?: string         // 可选的指定模型
  isSubAgent?: boolean   // 是否可作为子 Agent
}
```

### 两种 Agent

```
Build Agent（主 Agent，默认）
  - 权限：全部工具
  - 用途：编码、执行命令、修改文件
  - System prompt 重点：工具使用策略、代码质量要求
  - 类比：一个有完整权限的软件工程师

Plan Agent（主 Agent，可切换）
  - 权限：只读工具（read, grep, glob, list, question）
  - 无 write/edit/bash
  - 用途：需求分析、架构设计、代码审查
  - System prompt 重点：分析框架、输出格式
  - 类比：一个只做设计的架构师
```

### 切换机制

```
Tab 键切换：
  [Build] → 全权限编码
  [Plan]  → 只读分析
```

## 产出物

在 Stage 20 基础上：
- `agent/agent-definitions.ts` — Agent 定义注册表
- `agent/build-agent.ts` — Build Agent 的 system prompt
- `agent/plan-agent.ts` — Plan Agent 的 system prompt
- 修改 Server 支持 `X-Agent-Name` header
- 修改 TUI 支持 Tab 切换和 Agent 状态栏显示

## 实现要点

- Agent 定义中明确 `allowedTools`（Plan 只能 read/search/question）
- System prompt 根据 Agent 角色动态构建
- 不同 Agent 可以使用不同模型（Plan 用便宜的模型）
- 切换 Agent 时创建新的 session 或切换当前 session 的 agent

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 Agent 系统是一个完整的可注册架构：

1. **Agent Registry**
   不是硬编码的 if-else，而是注册表模式：
   ```typescript
   const agentRegistry = new Map<string, AgentDefinition>()
   agentRegistry.set("build", buildAgent)
   agentRegistry.set("plan", planAgent)
   ```

2. **Agent 级 System Prompt**
   OpenCode 的 system prompt 是动态拼装的多层架构：
   ```
   基础 Agent prompt（角色定义）
     + 项目上下文 prompt（文件结构、语言类型）
     + 工具描述 prompt（可用工具列表）
     + 约束 prompt（权限限制、输出格式）
   ```

3. **Agent 级权限控制**
   Plan Agent 的 `allowedTools` 限制了它不能调用 write/edit/bash——这是**在系统层面保证安全**，不是靠 LLM 自觉。

4. **Agent 级模型路由**
   Plan 可以用便宜的模型（只分析），Build 用最贵的模型（需要编码）。

### 对比其他 Agent

| Agent | 多 Agent | 角色类型 | 权限隔离 |
|-------|---------|---------|---------|
| **OpenCode** | ✅ Build/Plan/General/Explore/Compaction/Title | 6 种 | 系统级（allowedTools） |
| **Claude Code** | ❌ 单 Agent | 1 种 | — |
| **Aider** | ❌ 单 Agent | 1 种 | — |
| **Cursor** | ❌ 单 Agent（但有 Agent mode） | 1 种 | — |

### 关键洞察

多 Agent 系统的核心价值不在于"让 AI 做更多事"，而在于**角色分离带来的精度提升**：

- 单一 Agent 要做「理解需求 → 设计方案 → 编码实现 → 测试验证」全部的认知任务
- 多 Agent 让每个 Agent 只聚焦自己的领域，system prompt 更精炼，输出更可靠
- Plan Agent 先分析、Build Agent 后实现——这是一个经过验证的软件工程流程，AI 也应该遵循

OpenCode 的多 Agent 是**结构化的角色分工**，不是 Claude 那种"一个 Agent 换不同的 system prompt"。区别在于：结构化分工意味着权限在系统层被限制，Agent 不可能越权；而 system prompt 限制靠的是 LLM 自觉，随机性更高。

**下一步**：有了 2 个主 Agent。Stage 22 实现子 Agent（task 委派）。