# Stage 31 — 错误恢复与重试策略

> **承上**：前 30 个 Stage 构建了完整的功能系统
> **启下**：这是最后一个 Stage——让系统变得可靠和健壮

---

## 学习目标

1. 理解 Agent 系统中的常见错误类型和恢复策略
2. 掌握 Effect-TS 的错误处理模型（与 try/catch 的对比）
3. 理解 Agent 系统可靠性的工程实践

## 核心概念

### 错误分类

| 错误类型 | 示例 | 策略 |
|---------|------|------|
| **LLM API 错误** | 429 Rate Limit, 503 Service Down | 指数退避重试 |
| **LLM 输出错误** | 工具参数格式错误, JSON parse fail | 重试并要求 LLM 修正 |
| **工具执行错误** | 文件不存在, 命令超时 | 返回错误给 LLM，让它自行恢复 |
| **网络错误** | 连接断开, DNS 失败 | 重试 + 超时 |
| **系统错误** | 磁盘满, 权限不足 | 上报用户、无法自动恢复 |

### 指数退避重试

```
第 1 次失败 → 等待 1s → 重试
第 2 次失败 → 等待 2s → 重试
第 3 次失败 → 等待 4s → 重试
第 4 次失败 → 等待 8s → 重试
第 5 次失败 → 放弃，报告给用户
```

### LLM 自我修正

```
Agent 调用 read("不存在的文件")
  → 错误：文件不存在

Agent：（学习到了）
  → list("src/") 找出实际文件
  → read("src/实际文件.ts") → 成功！
```

## 产出物

在 Stage 30 基础上：
- `error/error-types.ts` — 错误类型定义
- `error/retry-policy.ts` — 重试策略
- `error/error-handler.ts` — 错误处理器
- 修改 `agent-loop.ts` 增加错误恢复
- 为所有工具添加 try/catch 和错误格式化

## 实现要点

- LLM API 错误：指数退避重试（最多 3-5 次）
- 工具执行错误：格式化后返回给 LLM（让 LLM 自行修正）
- 日志记录：所有错误记录到日志文件
- 用户友好的错误提示（不要直接显示技术堆栈）

---

## 技术洞察

### OpenCode 的做法

OpenCode 使用 Effect-TS 进行错误处理——这是一个与 try/catch 完全不同的思维模型：

1. **错误是类型的一部分**
   ```typescript
   // 传统方式
   async function readFile(path: string): Promise<string> {
     // 可能 throw，但类型签名看不出来
   }
   
   // Effect-TS 方式
   function readFile(path: string): Effect<FileSystem, FileError, string> {
     // FileError 是类型签名的一部分，编译器强制处理
   }
   ```

2. **Effect.retry**
   ```typescript
   const robustCall = pipe(
     Effect.tryPromise(() => callLLM(messages)),
     Effect.retry({
       times: 3,
       schedule: Schedule.exponential("1 second")
     })
   )
   ```

3. **错误恢复 vs 错误传播**
   ```typescript
   // 尝试主模型，失败后用备用模型
   const result = pipe(
     callModel("gpt-4o", messages),
     Effect.catchAll(() => callModel("gpt-4o-mini", messages))
   )
   ```

4. **子 Agent 的错误隔离**
   子 Agent 崩溃不会影响主 Agent——Effect-TS 的 Fiber 提供结构化并发，子 Fiber 的错误不会传播到父 Fiber。

### 对比其他 Agent

| Agent | 错误处理 | 重试策略 | 降级策略 |
|-------|---------|---------|---------|
| **OpenCode** | Effect-TS 类型化错误 | 指数退避 + 备用模型 | 子 Agent 隔离 + 模型降级 |
| **Claude Code** | try/catch | 有限重试 | 用户确认 |
| **Aider** | try/catch | 有限重试 | — |
| **LangChain** | Callback 错误处理 | 可配置 | 可自定义 |

### 关键洞察

Agent 系统的错误处理和普通应用有一个根本不同：

**在 Agent 系统中，LLM 本身可以参与错误恢复**。

普通应用：
```
磁盘满 → 显示错误 → 用户自己清理 → 重试
```

Agent 系统：
```
read 文件失败 → 错误返回给 LLM → LLM 分析原因 → LLM 尝试其他方式
```

这意味着 Agent 系统的错误处理需要两层：
1. **程序层**：重试、超时、降级（和普通应用一样）
2. **Agent 层**：将错误格式化后返回给 LLM，让 LLM 有自我修正的机会

OpenCode 在这两层都做得很好：程序层用 Effect-TS 的类型化错误处理，Agent 层用"错误即输入"的设计（工具执行失败 → 错误信息被注入下一轮 LLM 调用）。

**下一步**：这是最后一个 Stage。系统已经完整——从单次 LLM 调用到完整的 Client/Server 多客户端 Agent 系统。

---

## 学习路线回顾

```
Stage 01-03:  基础对话（单次调用 → 流式 → 多轮）
Stage 04:     Agent Loop（核心引擎）
Stage 05-07:  工具系统（读/写/搜索/Shell）
Stage 08:     权限系统（安全保障）
Stage 09-10:  Provider 层（模型自由）
Stage 11-13:  消息 & 持久化（Part 系统 → JSON → SQLite）
Stage 14:     配置系统（5 层级联）
Stage 15-16:  会话管理（分支 + 项目隔离）
Stage 17-18:  Server 架构（HTTP API + SSE）
Stage 19-20:  TUI 客户端（终端渲染 + 代码显示）
Stage 21-22:  多 Agent（角色分工 + 子 Agent 委派）
Stage 23:     LSP 集成（代码语义理解）
Stage 24:     MCP 集成（工具扩展标准）
Stage 25-27:  扩展系统（自定义工具 + Plugin + Skills）
Stage 28:     上下文压缩（长期运行保障）
Stage 29-30:  多客户端（Web + Desktop）
Stage 31:     错误恢复（可靠性）
```

每个 Stage 都是承上启下的，前一个 Stage 为后一个 Stage 创造了需求和条件。从 0 到 1，从单次 LLM 调用到一个完整的 AI 编程 Agent 系统。