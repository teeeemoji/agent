# Stage 12 — 会话持久化（JSON 文件 → SQLite）

> **承上**：Stage 11 构建了 Part 系统，但会话数据仍在内存中
> **启下**：持久化是会话管理的基础，为 Stage 13 的 SQLite 迁移和 Stage 15 的会话分支铺路

---

## 学习目标

1. 理解 Agent 系统为什么需要会话持久化
2. 掌握用 JSON 文件存储 Part 数组（简单方案）
3. 认识 JSON 文件存储的局限性，为 SQLite 迁移做铺垫

## 核心概念

### 为什么需要持久化

| 场景 | 无持久化 | 有持久化 |
|------|---------|---------|
| 关闭终端 | ❌ 对话丢失 | ✅ 下次恢复 |
| 长对话 | ❌ 内存爆炸 | ✅ 按需加载 |
| 多 session | ❌ 只能一个 | ✅ 切换 session |
| 分析回顾 | ❌ 无历史 | ✅ 可查询 |

### JSON 文件方案

```
~/.miniagent/
├── sessions/
│   ├── session-001.json   ← { id, title, messages: [...], createdAt }
│   ├── session-002.json
│   └── session-003.json
└── index.json             ← { currentSession: "session-001" }
```

## 产出物

在 Stage 11 基础上：
- `session/session-store.ts` — 会话存储（JSON 文件实现）
- `session/session-manager.ts` — 会话管理（创建、加载、切换、列表）
- 修改 CLI 支持 `--session` 和 `/sessions` 命令

## 实现要点

- 会话目录：`~/.miniagent/sessions/`
- 每个 session 一个 JSON 文件，文件名为 session ID
- `index.json` 追踪当前活跃 session
- CLI 命令：
  - `/sessions` 列出所有会话
  - `/session <id>` 切换会话
  - `/new` 创建新会话

---

## 技术洞察

### OpenCode 的做法

OpenCode 使用 SQLite + Drizzle ORM 进行会话持久化：

```
~/.local/share/opencode/project/<hash>/data.db
  ├── sessions 表
  ├── messages 表
  ├── permissions 表
  └── ... 更多表
```

Design decisions：
1. **数据库而非文件**：支持复杂查询（最近会话、按 Agent 筛选）、事务、并发安全
2. **项目级隔离**：每个项目有自己的 data.db，hash 来自项目路径
3. **Part 存储在消息的 JSON 列**：SQLite JSON 类型，支持索引查询
4. **Drizzle ORM**：TypeScript 类型安全 + 迁移管理

### 对比其他 Agent

| Agent | 持久化方案 | 特点 |
|-------|----------|------|
| **OpenCode** | SQLite（Drizzle ORM），项目级 | 高级、性能好、支持查询 |
| **Claude Code** | JSON 文件 | 简单，会话间独立 |
| **Aider** | Git 的 chat history | 利用 Git 版本控制 |
| **ChatGPT Web** | 服务端数据库 | 平台管理 |

### 关键洞察

为什么 OpenCode 选 SQLite 而不是更简单的 JSON 文件？

1. **并发**：多客户端同时读写同一 session 时，SQLite 的事务比 JSON 文件可靠得多
2. **查询**：`SELECT * FROM sessions WHERE agent_name = 'build' ORDER BY created_at DESC` — 这不是 JSON 文件能轻易做到的
3. **权限表**：权限规则需要在 session 表和全局配置间做查询，SQLite JOIN 天然支持
4. **崩溃恢复**：SQLite 的 WAL（Write-Ahead Log）模式保证崩溃后数据不会损坏

**本阶段用 JSON 文件是故意的**——这样你能对比两种方案的优劣，理解 OpenCode 选择 SQLite 的原因。

**下一步**：JSON 文件方案在生产环境不够用。Stage 13 迁移到 SQLite。