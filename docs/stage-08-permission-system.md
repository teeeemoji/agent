# Stage 08 — 权限系统

> **承上**：Stage 05-07 给了 Agent 强大的文件操作和命令执行能力
> **启下**：权限系统是安全保障，后续多 Agent 系统共享同一套权限框架

---

## 学习目标

1. 理解 Agent 权限系统的核心概念：allow / deny / ask
2. 掌握 glob pattern 匹配实现细粒度权限
3. 理解权限持久化的必要性

## 核心概念

### 三种权限动作

```
allow  — 自动批准，不询问用户
deny   — 自动拒绝，不执行
ask    — 每次询问用户确认

例如：
  read:   { "*.env": "deny", "**": "allow" }    ← 除了 .env 全可读
  bash:   { "rm -rf *": "deny", "git *": "allow", "**": "ask" }
  edit:   { "src/**": "allow", "**": "ask" }    ← src 下自动编辑
```

### Glob 匹配

Glob 模式匹配是权限系统的关键技术：
- `**` — 匹配一切
- `*.env` — 匹配当前目录的 .env 文件
- `src/**` — 匹配 src 目录下的所有文件

### 权限优先级

```
1. 拒绝规则（deny）—— 最高优先级
2. 明确允许（allow）—— 中等优先级
3. 询问用户（ask）—— 最低优先级
```

## 产出物

在 Stage 07 基础上：
- `permission/permission-manager.ts` — 权限管理器
- 修改 `agent-loop.ts` 在工具执行前检查权限
- 添加 `.miniagent/permissions.json` 配置文件
- 在 `question` 交互中实现用户确认流程（先做简单的 CLI 提问）

## 实现要点

- 实现 `checkPermission(toolName, input)` → `allow | deny | ask`
- Glob pattern 匹配使用 `micromatch` 或自行实现简单版本
- ask 模式：暂停 Agent Loop，等待用户在终端输入 y/n
- 权限规则支持从配置文件加载
- `deny` 规则优先于 `allow`

---

## 技术洞察

### OpenCode 的做法

OpenCode 的权限系统比本阶段复杂得多：

1. **三层权限模型**
   ```
   Session 级权限（最高优先级）
     ↓
   Agent 级权限
     ↓
   全局配置权限（最低优先级）
   ```
   这意味着你可以在一次会话中临时提升权限，不影响其他 session。

2. **最后匹配的 glob 生效**
   ```json
   "bash": {
     "rm *": "deny",
     "rm *.log": "allow"    ← 后写的覆盖前面
   }
   ```

3. **权限持久化到 SQLite**
   用户批准过一次 `git push origin main`，下次不再询问。
   权限存储在数据库中，不是纯配置文件。

4. **Agent 级权限控制**
   比如 Plan Agent 天生没有 write/edit/bash 权限——在 Agent 定义时就限制了。

### 对比其他 Agent

| Agent | 权限模型 | 粒度 | 持久化 |
|-------|---------|------|--------|
| **OpenCode** | 3 层 + glob + allow/deny/ask | 工具 × glob 模式 | ✅ SQLite |
| **Claude Code** | 全局 allow/deny 开关 | 工具级 | ✅ |
| **Aider** | YOLO/Auto/Ask 三模式 | 操作级 | ❌ |
| **Cursor** | 工具级确认弹窗 | 工具级 | 通过 IDE 管理 |

### 关键洞察

权限系统设计中的一个核心权衡：**安全 vs 流畅度**。

- 每个操作都 `ask` → 最安全但最打断工作流
- 全部 `allow` → 最流畅但最危险（Aider 的 YOLO 模式）
- OpenCode 的 glob 匹配是一种折中：对已知安全模式自动放行，未知模式询问

另一个洞察：**权限持久化是体验的关键**。如果 Agent 每次都问"可以执行 git status 吗？"，用户很快会关掉权限检查。OpenCode 的"记住这次选择"让权限系统在实践中可用。

**下一步**：当前只有一种 LLM Provider。Stage 09-10 实现 Provider 抽象层。