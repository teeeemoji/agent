# Stage 14 — 配置系统（5 层级联合并）

> **承上**：系统的配置分散在各处（环境变量、CLI 参数、硬编码）
> **启下**：统一配置系统让所有模块按一致的规则获取配置，支持项目级隔离

---

## 学习目标

1. 理解配置级联（cascade）的设计模式
2. 掌握配置合并策略（深度 merge + 优先级覆盖）
3. 理解为什么需要多层级配置

## 核心概念

### 5 层配置级联

```
优先级从高到低：

1. CLI 参数           --model claude-sonnet
     ↓ 覆盖
2. 环境变量           OPENCODE_MODEL=claude-sonnet
     ↓ 覆盖
3. 项目配置文件       ./opencode.json
     ↓ 覆盖
4. 用户全局配置       ~/.config/opencode/config.json
     ↓ 覆盖
5. 内置默认值         硬编码的 defaults
```

### 为什么需要多层级

```
场景 1：你在公司项目里想用特定模型     → 写在项目 opencode.json
场景 2：你在家里想用另一个模型          → 写在全局 config.json
场景 3：今天临时想试试新模型            → 加 --model 参数
场景 4：CI 环境不给配置文件            → 用环境变量
```

每个层级对应不同的**作用域**和**时效性**。

## 产出物

在 Stage 13 基础上：
- `config/config-loader.ts` — 配置加载器
- `config/config-schema.ts` — 配置结构（Zod schema 校验）
- `config/defaults.ts` — 内置默认值
- 创建示例 `opencode.json` 和 `~/.miniagent/config.json`
- 修改所有模块通过配置系统获取参数

## 实现要点

- 逐层加载配置，高优先级覆盖低优先级
- 使用 `lodash.merge` 或自定义 deepMerge
- Zod schema 校验合并后的配置
- CLI 使用 `commander` 或 `yargs` 解析参数

---

## 技术洞察

### OpenCode 的做法

OpenCode 的配置系统有几个精妙设计：

1. **配置 schema 是公开发布的**
   ```json
   // opencode-schema.json — 随项目发布
   {
     "$schema": "http://json-schema.org/draft-07/schema#",
     "properties": {
       "model": { "type": "string" },
       "agent": { "type": "string", "enum": ["build", "plan"] },
       "permission": { ... },
       "provider": { ... },
       "lsp": { ... },
       "mcp": { ... }
     }
   }
   ```
   这让 IDE 能给 `opencode.json` 提供自动补全。

2. **Provider 配置在配置文件中**
   ```json
   {
     "provider": {
       "anthropic": {
         "models": {
           "claude-sonnet": { "name": "Claude Sonnet", "apiKey": "env:ANTHROPIC_API_KEY" }
         }
       }
     }
   }
   ```
   API key 不写在配置里，而是 `"env:ANTHROPIC_API_KEY"` 引用环境变量。

3. **LSP 配置**
   ```json
   {
     "lsp": {
       "typescript": { "enabled": true },
       "python": { "enabled": false }
     }
   }
   ```

### 对比其他 Agent

| Agent | 配置方式 | 层级数 |
|-------|---------|--------|
| **OpenCode** | opencode.json + 5 层级联 | 5 |
| **Claude Code** | `.claude/settings.json` + 环境变量 | 2-3 |
| **Aider** | `.aider.conf.yml` + CLI args | 2 |
| **Cursor** | IDE Settings UI + `.cursorrules` | 2 |

### 关键洞察

配置级联模式来自 VSCode 的设计哲学：Workspace Settings > User Settings > Defaults。这是一种经过验证的设计模式。

OpenCode 把它扩展到了 Agent 场景：
- 多项目同时开发 = 每个项目有独立配置
- CI 环境 = 通过环境变量覆盖
- 团队成员共享 = 把 `opencode.json` 提交到 Git

**下一个真正重要的点**：配置文件和权限文件的 schema 都应该发布为 JSON Schema——这会让 IDE 提供自动补全和校验，大大提高可用性。

**下一步**：配置系统就绪了。Stage 15 实现会话分支（Session Branching）。