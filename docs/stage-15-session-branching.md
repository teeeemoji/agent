# Stage 15 — 会话分支（Session Branching）

> **承上**：Stage 13 让会话持久化到 SQLite，Stage 14 让配置系统完整
> **启下**：会话分支是 OpenCode 的特色功能，也为 Stage 22 的子 Agent 独立上下文打下基础

---

## 学习目标

1. 理解会话分支的概念——从任意历史点分叉对话
2. 掌握 SQLite 中树形结构的存储和查询
3. 理解 Branching 对 Agent 调试和探索的价值

## 核心概念

### Git 分支类比

```
Git 分支：
  main  ──●──●──●──●──●
                 \
  feature        ●──●──●

Session 分支：
  session-1  ──msg1──msg2──msg3──msg4
                          \
  session-1-branch         msg5──msg6
```

### 数据结构

```sql
-- sessions 表增加 parent_session_id 和 fork_point
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  parent_session_id TEXT,    -- 父 session（用于分支）
  fork_message_id TEXT,       -- 从哪个消息分叉
  agent_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

## 产出物

在 Stage 14 基础上：
- 修改 `db/schema.ts` 增加分支相关字段
- `session/session-branch.ts` — 分支创建和查询
- CLI 命令：`/branch <name>` 创建分支

## 实现要点

- 分支创建：复制父 session 的分叉点之前的消息 + 开始新消息
- 查询分支树：递归查询 parent_session_id
- CLI 显示分支关系

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 session 分支是一个**核心功能**，不是后加的功能：

1. **父子关系在数据库层**
   `parent_session_id` 和 `fork_message_id` 是 session 表的标准列。

2. **每个分支有独立的权限**
   分支 A 的权限批准不影响分支 B——权限绑定到 session 而非全局。

3. **分支的应用场景**
   - **尝试不同方案**：从同一个起点分叉，尝试方案 A 和方案 B
   - **Rollback**：发现 Agent 搞坏了代码，回退到分叉点重新开始
   - **子 Agent 天然支持**：子 Agent 本质上是 session 的一个新分支

### 对比其他 Agent

| Agent | 会话分支 | 实现 |
|-------|---------|------|
| **OpenCode** | ✅ 完整分支系统 | SQLite 树形结构 |
| **Claude Code** | ❌ 不支持 | — |
| **Aider** | ❌ 不支持（但可以用 Git） | — |
| **ChatGPT Web** | ❌ 不支持 | — |
| **Cursor** | ❌ 不支持 | — |

### 关键洞察

会话分支是 OpenCode 区别于大多数 Agent 的特色功能。它反映了一个重要的设计哲学：

**Agent 的操作是不可逆的（修改文件、执行命令），但对话路径应该是可逆的（可以回溯并尝试不同路径）。**

在传统编程中，你不会因为写了一段代码就"锁定"了代码的未来——你可以新建分支尝试不同实现。OpenCode 把同样的自由给了 Agent 对话。

分支还直接支持了子 Agent 的实现（Stage 22）：每个子 Agent 本质上是主 session 的一个分支，有自己的消息历史、工具权限和执行上下文。

**下一步**：分支功能让 session 变树形了。Stage 16 加入项目级隔离。