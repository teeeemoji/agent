# Stage 28 — 上下文压缩（Context Compaction）

> **承上**：长对话产生大量 token，成本高 + LLM 注意力分散
> **启下**：上下文压缩是 Agent 能长期运行的基础设施

---

## 学习目标

1. 理解上下文压缩的必要性——token 增长与 LLM 性能的反比关系
2. 掌握 OpenCode 的三阶段压缩策略（Pruning → Compaction → Replacement）
3. 理解"用 LLM 压缩 LLM 的上下文"的元循环

## 核心概念

### 问题：token 线性增长

```
对话进行中：
  Turn 1:  1,000 tokens
  Turn 5:  8,000 tokens
  Turn 10: 18,000 tokens
  Turn 20: 40,000 tokens → 接近模型上限 → 必须压缩
```

### 三阶段压缩策略

| 阶段 | 操作 | 触发条件 | 效果 |
|------|------|---------|------|
| **1. Pruning** | 删除冗余内容 | Token 达阈值 | 移除重复 tool result、无用信息 |
| **2. Compaction** | LLM 压缩摘要 | Pruning 后仍超标 | 用结构化摘要替换历史 |
| **3. Replacement** | 替换整段上下文 | Compaction 仍不足 | 在压缩基础上进一步精简 |

### Compaction 过程

```
原始历史（8000 tokens）：
  User: 帮我修复 auth bug
  Agent: read("auth.ts") → [文件内容]
  Agent: 发现问题在第 42 行...
  Agent: edit("auth.ts", ...) → 修改成功
  Agent: bash("npm test") → PASS
  User: 还有一个问题...

压缩后（500 tokens）：
  [摘要]
  - 任务：修复 auth.ts 中的登录 bug
  - 已完成：修改 auth.ts 第 42 行（JWT 过期时间错误）
  - 当前状态：修复后测试通过
  - 待处理：用户提到还有另一个问题
```

## 产出物

在 Stage 27 基础上：
- `context/context-manager.ts` — 上下文管理器
- `context/pruner.ts` — Pruning 实现
- `context/compactor.ts` — Compaction 实现
- `context/token-counter.ts` — Token 计数

## 实现要点

- Token 计数：使用 tiktoken 或近似算法
- Pruning：移除重复的 tool result、系统消息中的冗余
- Compaction：调用 LLM（便宜的模型）生成结构化摘要
- 摘要保留：已完成事项、未完成事项、关键决策、当前状态
- 压缩触发时机：token 达到配置的阈值（如 80% 模型限制）

---

## 技术洞察

### OpenCode 的做法

OpenCode 的上下文压缩是一个专门的子系统：

1. **Compaction Agent**
   OpenCode 有一个隐藏的 `Compaction` Agent，专门负责上下文压缩：
   ```
   上下文压缩 = Compaction Agent（独立 session，独立 LLM 调用）
   
   输入：原始对话历史
   输出：结构化摘要（JSON 格式）
     {
       completedTasks: [...],     ← 已完成的任务
       pendingTasks: [...],       ← 未完成的任务
       keyDecisions: [...],       ← 关键决策
       currentState: "...",       ← 当前状态
       importantContext: "..."    ← 重要上下文片段
     }
   ```

2. **用便宜的模型做压缩**
   Compaction Agent 用便宜的模型（如 Claude Haiku 或 GPT-4o-mini），压缩成本很低。

3. **Compaction 不丢关键信息**
   不是简单地"取前 N 条消息"，而是用 LLM 理解并总结——保留语义信息，去掉冗余。

4. **分层摘要**
   在大规模多 Agent 场景中（OMO 插件），上下文压缩是分层的：
   ```
   子 Agent 摘要 → 主 Agent
   主 Agent 摘要 → 全局上下文
   ```

### 对比其他 Agent

| Agent | 压缩策略 | 方法 | Token 管理 |
|-------|---------|------|-----------|
| **OpenCode** | 3 阶段：Pruning → Compaction → Replacement | LLM 压缩 + 结构化摘要 | 动态阈值 |
| **Claude Code** | 滚动窗口 + truncation | 简单截断 | 固定限制 |
| **Aider** | Map-Reduce 风格 | 编辑历史压缩 | 基于树的 map |
| **Cursor** | 文件相关性排序 | 不压缩，裁剪不相关 | 按文件相关性 |

### 关键洞察

上下文压缩是 Agent 系统的"垃圾回收"机制：

- 不压缩 → token 成本线性增长 → 对话越长越贵 → 用户被迫缩短对话
- 简单截断 → 丢失关键上下文 → Agent 忘记前面的决策 → 行为不一致
- LLM 压缩 → 保留语义、去掉冗余 → 成本可控 + 行为一致

OpenCode 的做法体现了"元循环"思想——**用 LLM 管理 LLM 的上下文**。Compaction Agent 只是一个普通的子 Agent，它的任务就是"总结对话历史"。这个简单的设计让上下文压缩变得可配置、可优化、可替换（如果未来有更好的压缩方法，换掉 Compaction Agent 就行了）。

**下一步**：Agent 核心系统完整了。Stage 29 实现 Web UI。