# Stage 13 — SQLite 迁移 + Drizzle ORM

> **承上**：Stage 12 用 JSON 文件存储会话
> **启下**：SQLite 的高性能和高可靠性让会话管理、权限持久化、配置隔离都成为可能

---

## 学习目标

1. 掌握 SQLite 在 Node.js/Bun 中的使用
2. 理解 Drizzle ORM 的 schema 定义和迁移
3. 掌握从文件存储到数据库的重构策略

## 核心概念

### SQLite 核心优势

```
JSON 文件方案（Stage 12）：
  - 读写整个文件 → O(n) 序列化/反序列化
  - 无事务 → 并发写可能损坏
  - 无查询 → 必须遍历

SQLite 方案（Stage 13）：
  - B-tree 索引 → O(log n) 读写
  - WAL 事务 → 并发安全
  - SQL 查询 → 灵活筛选
```

### Drizzle ORM Schema

```typescript
// sessions 表
const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  agentName: text("agent_name").notNull().default("build"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

// messages 表
const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id).notNull(),
  role: text("role").notNull(),
  parts: text("parts", { mode: "json" }).$type<Part[]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})
```

## 产出物

在 Stage 12 基础上重构：
- `db/schema.ts` — Drizzle schema 定义
- `db/database.ts` — 数据库连接和迁移
- `db/session-repository.ts` — 会话 CRUD
- `db/message-repository.ts` — 消息 CRUD
- 替换 `session-store.ts` 从 JSON 文件改为 SQLite

## 实现要点

- 使用 Bun 内置的 `bun:sqlite`（速度快）或 `better-sqlite3`
- Drizzle ORM 定义 schema
- 实现 session CRUD：创建、查询、删除、列表
- 实现 message CRUD：添加消息、按 session 查询消息
- Part 数组存储在 JSON 列中

---

## 技术洞察

### OpenCode 的做法

OpenCode 的数据库设计有特别之处：

1. **Database.effect 模式**
   不是简单的 async/await，而是用 Effect-TS 包装数据库操作：
   ```typescript
   // 不是这样
   const session = await db.select().from(sessions).where(...)
   
   // OpenCode 是这样
   const session = await Effect.runPromise(
     Database.pipe(
       Effect.flatMap(() => SessionRepo.findById(id)),
       Effect.provide(Database.layer)
     )
   )
   ```
   好处：依赖注入、错误追踪、自动资源管理。

2. **每项目独立数据库**
   ```
   ~/.local/share/opencode/
   ├── project/<hash-project-a>/data.db
   ├── project/<hash-project-b>/data.db
   └── ...
   ```
   Instance 的 `provide()` 中间件为每个请求绑定项目上下文。

3. **WAL 模式**
   SQLite 默认 journal 模式是 DELETE，OpenCode 用的是 WAL（Write-Ahead Log）。WAL 允许并发读 + 单一写，适合多客户端场景。

### 对比其他 Agent

| Agent | 数据库 | ORM | 隔离级别 |
|-------|--------|-----|---------|
| **OpenCode** | SQLite | Drizzle | 项目级（独立 DB 文件） |
| **Claude Code** | JSON 文件 | 无 | 进程级 |
| **Aider** | 无（内存 + Git） | 无 | 进程级 |
| **Cursor** | SQLite（推测） | — | 用户级 |

### 关键洞察

数据库选型反映了 Agent 系统的架构野心：
- 用 JSON 文件 = 单人单机使用的工具
- 用 SQLite = 可扩展为多客户端、多项目的平台
- 用 PostgreSQL = 云端 SaaS

OpenCode 选 SQLite 是务实的：本地运行的需要轻量，但又需要足够的查询能力来支持多 session、多 Agent、权限查询等功能。

**下一步**：数据库就绪了。Stage 14 实现 OpenCode 风格的配置系统。