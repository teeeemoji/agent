# Stage 16 — 项目级隔离

> **承上**：Stage 15 实现了会话分支，但所有项目混在同一个数据库
> **启下**：项目隔离是 Client/Server 架构的前提，Stage 17 的 HTTP Server 依赖此设计

---

## 学习目标

1. 理解为什么 Agent 系统需要项目级隔离
2. 掌握基于项目路径 hash 的多数据库策略
3. 理解 Instance context 的概念（每请求绑定项目）

## 核心概念

### 为什么需要项目隔离

```
没有隔离：
  data.db  ← 包含项目 A 的 session + 项目 B 的 session + 项目 C 的 session
  问题：权限规则混在一起、切换项目时 session 混乱、不同项目的 .gitignore 不同

有隔离：
  project/hash-A/data.db  ← 只有项目 A 的数据
  project/hash-B/data.db  ← 只有项目 B 的数据
```

### 项目路径 Hash

```typescript
// 对项目路径做 hash，生成唯一标识
const projectHash = crypto
  .createHash("sha256")
  .update(process.cwd())  // 项目根目录
  .digest("hex")
  .slice(0, 16)

const dbPath = path.join(dataDir, "project", projectHash, "data.db")
```

### Instance Context

```
每个请求到达时：
  ├── 从请求中提取项目路径（Header: X-Project-Dir）
  ├── 根据路径 hash 定位数据库
  ├── 打开/创建对应的 SQLite 连接
  └── 将数据库实例绑定到请求上下文
```

## 产出物

在 Stage 15 基础上：
- `project/project-resolver.ts` — 项目路径 → hash → 数据库
- 修改所有文件路径操作为项目根目录相对路径
- 多项目测试：在不同目录运行，数据隔离

## 实现要点

- 使用项目绝对路径的 hash 作为数据库目录名
- 每个项目有独立的 `data.db`
- 项目切换时自动定位对应数据库
- 测试：在 /project-a 创建 session → 在 /project-b 看不到

---

## 技术洞察

### OpenCode 的做法

OpenCode 的项目隔离是整个架构的基础：

1. **Instance.provide() 中间件**
   ```typescript
   // Hono 中间件
   app.use("*", async (c, next) => {
     const projectDir = c.req.header("X-Project-Dir") || process.cwd()
     const db = await getProjectDb(projectDir)
     c.set("db", db)
     c.set("projectDir", projectDir)
     await next()
   })
   ```

2. **数据库路径**
   ```
   ~/.local/share/opencode/
   ├── project/
   │   ├── a3f2c1b0/  ← hash of /home/user/project-a
   │   │   └── data.db
   │   ├── 7d8e9f01/  ← hash of /home/user/project-b
   │   │   └── data.db
   │   └── ...
   ├── auth.json       ← 全局认证信息
   └── config.json     ← 全局配置
   ```

3. **工具执行绑定项目上下文**
   所有工具（read, write, grep, bash）的 `cwd` 都被绑定到项目目录。

### 对比其他 Agent

| Agent | 项目隔离 | 实现 |
|-------|---------|------|
| **OpenCode** | ✅ 项目级 SQLite，hash 隔离 | 自动 |
| **Claude Code** | ❌ 单个项目（与工作目录绑定） | — |
| **Aider** | ❌ 单个项目（与 git repo 绑定） | — |
| **Cursor** | N/A（IDE 项目天然隔离） | IDE 提供 |

### 关键洞察

项目级隔离让 OpenCode 从一个"单项目工具"变成了一个"可同时管理多项目的平台"：

- 开发者经常同时维护多个项目（主项目 + 依赖库 + 内部工具）
- OpenCode 可以在不同项目间切换而不会混淆 session 和权限
- 这个设计直接服务于后续的 Client/Server 架构（Stage 17）：一个 Server 可以同时服务多个项目的请求

**下一步**：项目隔离让数据层完整了。Stage 17 把 Agent 变成一个 HTTP Server。