# Stage 27 — Skills 系统（按需知识注入）

> **承上**：Plugin 是行为扩展，Skills 是知识扩展
> **启下**：Skills 是上下文工程的重要组成——在需要时才加载专业知识

---

## 学习目标

1. 理解 Skills 与 Plugin/Tool 的区别——知识包 vs 行为扩展 vs 工具
2. 掌握按需上下文注入的设计模式
3. 理解 token 预算管理——为什么知识应该"按需"而非"全量"加载

## 核心概念

### Skills 是什么

Skills 是**按需加载的知识包**，告诉 Agent 如何处理特定领域的任务：

```
没有 Skill：
  User: 帮我配置 Nginx 反向代理
  Agent: （不知道 Nginx 最佳实践，随机发挥）

有 Skill：
  User: 帮我配置 Nginx 反向代理
  Agent: /skill nginx-config
  → 加载 Nginx 配置知识（常见模式、安全注意事项）
  → Agent: （按照最佳实践生成配置）
```

### Skill 加载时机

```
方式 1：Agent 主动调用 skill 工具
  Agent: skill("nginx-config") → 加载 Nginx 知识

方式 2：配置自动加载
  在 opencode.json 中配置某些 skill 总是在 session 开始时加载

方式 3：Plugin 触发
  Plugin 在 onSessionStart 时自动注入 skill
```

### Skill 结构

```typescript
interface Skill {
  name: string
  description: string            // Agent 用它判断何时需要此 skill
  content: string                // 注入到上下文的实际内容
  triggers?: string[]            // 触发关键词（可选）
  tools?: string[]               // 需要的额外工具（可选）
}
```

## 产出物

在 Stage 26 基础上：
- `skill/skill-loader.ts` — Skill 加载器
- `skill/skill-registry.ts` — Skill 注册表
- `tools/skill.ts` — skill 工具（Agent 主动调用）
- 示例 skill：`nginx-config`, `docker-compose`, `testing-best-practices`

## 实现要点

- Skill 从 `.opencode/skills/` 目录加载
- `skill` 工具让 Agent 能主动激活 skill
- 激活的 skill 内容作为 system 消息注入上下文
- 同一个 skill 在一个 session 中只加载一次（去重）

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 Skills 系统是为"专业知识注入"而设计的：

1. **Skill vs Plugin vs Tool**
   ```
   Tool   — 被调用的能力（read, write, bash）
   Plugin — 主动响应的行为（before-tool, after-message）
   Skill  — 按需加载的知识（nginx 配置、Docker 最佳实践）
   ```

2. **Skill 内容注入方式**
   不是追加到 user 消息，而是作为 system 消息注入——这很重要：
   - System 消息在 LLM 的注意力中权重更高
   - 不会与用户消息混淆

3. **Skill 的 token 管理**
   Skills 按需加载，不在对话中时**不占用 token**。与始终在 system prompt 中的指令相比，这节省了大量 token。

4. **Skill 社区生态**
   用户可以发布和共享 skills，形成一个知识市场。

### 对比其他 Agent

| Agent | 知识系统 | 加载时机 | Token 管理 |
|-------|---------|---------|-----------|
| **OpenCode** | Skills 系统 | 按需 + 自动 | 不活跃时不占 token |
| **Claude Code** | 无独立系统 | — | — |
| **Aider** | 无独立系统 | — | — |
| **Cursor** | .cursorrules + Rules for AI | 始终加载 | 始终占 token |
| **GitHub Copilot** | Custom instructions | 始终加载 | 始终占 token |

### 关键洞察

Skills 的设计体现了"上下文工程"的核心原则：**不在上下文中的知识 = 不存在的知识**。但把所有知识都放进去 → token 爆炸 → 成本高 + LLM 注意力分散。

Skills 的方案是折中：
- 有一个 skill registry（Agent 知道有哪些 skill 可用）
- Agent 判断"我需要 Nginx 知识"，调用 `skill("nginx")`
- Skill 内容注入上下文，Agent 获得专业知识
- 任务完成后，skill 不再是上下文的一部分

这个"just-in-time knowledge loading"模式将在 Stage 28（上下文压缩）中进一步深化——当对话太长时，用压缩摘要替换原始历史，也是同样的哲学：

**知识的粒度应该与当前任务匹配，既不缺也不冗余。**

**下一步**：Skills 让 Agent 获得了知识。Stage 28 处理对话太长时的上下文压缩。