# Stage 06 — 搜索工具（grep / glob / list）

> **承上**：Stage 05 让 Agent 能读写文件，但不知道文件在哪
> **启下**：搜索工具让 Agent 能探索和导航代码库，是自主性的关键

---

## 学习目标

1. 理解代码库搜索的三种模式（文本搜索、文件名匹配、目录浏览）
2. 掌握 `.gitignore` 感知的文件遍历
3. 理解搜索结果展示如何影响 LLM 的决策质量

## 核心概念

### 三种搜索模式

```
grep  - "代码里哪里用了 'UserModel'？"        → 文本内容搜索
glob  - "项目里有哪些 *.test.ts 文件？"        → 文件名模式匹配
list  - "src/ 目录下有什么？"                 → 目录结构浏览
```

### 搜索结果的质量问题

搜索结果过多 → LLM 上下文爆炸，分析困难
搜索结果过少 → LLM 找不到关键信息，无法工作
`grep` 结果太长 → 需要截断和格式化

## 产出物

在 Stage 05 基础上：
- `tools/grep.ts` — 文本内容搜索
- `tools/glob.ts` — 文件名模式匹配
- `tools/list.ts` — 目录列表
- 增强 `tool-registry.ts`

## 实现要点

- `grep`：使用 Node.js `child_process` 调用系统 `grep` 或内置实现
- `glob`：使用 `fast-glob` 或 Node.js `fs.readdirSync` 递归
- `list`：输出树形结构
- 所有工具遵守 `.gitignore` 规则（排除 node_modules、.git 等）
- 搜索结果限制数量（如最多 100 条），防止上下文爆炸

---

## 技术洞察

### OpenCode 的做法

1. **grep 内部调用 ripgrep**
   - ripgrep (rg) 比系统 grep 快 10-100 倍
   - 原生支持 `.gitignore` 规则，自动排除二进制文件

2. **glob 结果按修改时间排序**
   ```typescript
   // OpenCode 的做法
   const results = await glob(pattern)
   // 按 mtime 降序排列，最近修改的文件最靠前
   const sorted = results.sort((a, b) => b.mtime - a.mtime)
   return sorted.slice(0, limit)
   ```
   这个排序策略很聪明：最近修改的文件通常与当前任务最相关。

3. **list 输出树形结构 + 限制深度**
   不会展开整个项目的树（那会非常长），而是限制到 2-3 层深度。

### 对比其他 Agent

| Agent | 搜索策略 | 特点 |
|-------|---------|------|
| **OpenCode** | ripgrep + glob + list | 速度快、gitignore 感知 |
| **Claude Code** | 内置搜索，类似 rg | 自动触发 |
| **Aider** | 自动构建仓库 map | 不需要用户指定搜索 |
| **Cursor** | 代码库索引 + 语义搜索 | 向量化、语义理解 |

### 关键洞察

搜索工具的质量直接影响 Agent 的**自主性**：

- **好的搜索 = Agent 能自己找到需要的信息**，用户不用手动指定文件
- **差的搜索 = Agent 反复读错文件、找不到函数定义**，用户被迫在 prompt 里手动给路径
- **Aider 的策略很有趣**：它自动构建一个"仓库地图"（repo map），让 LLM 在上下文里始终能看到项目结构概览。这比 OpenCode 的"让 Agent 自己搜索"更主动。

OpenCode 选择了工具化路线（让 Agent 学会搜索），Aider 选择了预计算路线（提前算好地图）。两种思路的差异反映了对 Agent 自主性的不同理解。

**下一步**：文件 + 搜索工具让 Agent 能看和找了。Stage 07 让 Agent 能执行命令。