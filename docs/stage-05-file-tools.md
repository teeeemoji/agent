# Stage 05 — 文件操作工具（read / write / edit）

> **承上**：Stage 04 实现了 Agent Loop，但只有伪工具
> **启下**：文件工具是编码 Agent 的"手"，后面搜索工具和 Shell 工具同理扩展

---

## 学习目标

1. 理解 Tool Calling（Function Calling）协议的标准格式
2. 掌握工具注册表（Tool Registry）的设计
3. 理解 `read` / `write` / `edit` 三种不同粒度的文件操作模式

## 核心概念

### Tool Calling 协议

现代 LLM 支持标准化的 function calling：

```json
// 请求中告知 LLM 可用工具
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read",
        "description": "读取文件内容",
        "parameters": {
          "type": "object",
          "properties": {
            "file_path": { "type": "string", "description": "文件路径" },
            "offset": { "type": "integer", "description": "起始行" },
            "limit": { "type": "integer", "description": "读取行数" }
          }
        }
      }
    }
  ]
}
```

LLM 返回时不在 `content` 中输出文本，而是：
```json
{
  "tool_calls": [
    {
      "id": "call_xxx",
      "function": { "name": "read", "arguments": "{\"file_path\": \"src/main.ts\"}" }
    }
  ]
}
```

### 三种文件操作模式

```
read  - "请读取这个文件"        → 返回文件内容（可指定行范围）
write - "请创建/覆盖这个文件"     → 新建或完全替换
edit  - "请修改文件的第 10-15 行" → 基于 search/replace 的部分修改
```

## 产出物

在 Stage 04 基础上修改：
- `tool-registry.ts` 正式实现工具注册
- `tools/read.ts` — 文件读取工具
- `tools/write.ts` — 文件创建/覆盖工具
- `tools/edit.ts` — 文件部分编辑工具
- 修改 `agent-loop.ts` 支持 LLM 原生 tool-calling

## 实现要点

- 使用 LLM 的 native function calling（需要支持该特性的模型，如 gpt-4o, claude-3.5-sonnet）
- Tool Registry 使用 Map 结构：`Map<string, Tool>`
- 每个 Tool 有：name、description、parameters（JSON Schema）、execute 函数
- `edit` 工具使用 search/replace 模式：找到 old_str → 替换为 new_str
- 操作结果用 markdown 格式化返回给 LLM

---

## 技术洞察

### OpenCode 的做法

OpenCode 的文件工具有几个精细设计：

1. **`read` 工具内置 LSP 诊断**
   读取文件时自动附加 LSP 的 diagnostic 信息（错误、警告、提示）。这让 Agent 在"看一眼"这个动作中就能发现问题。

2. **`edit` 不是行号编辑，是 search/replace**
   ```
   edit(path="src/main.ts", old_str="return x + y", new_str="return x + y + z")
   ```
   用内容匹配而非行号——因为 LLM 不知道准确的行号。

3. **`patch` 工具作为补充**
   当需要批量修改多个位置时，`patch`（diff 格式）比多次 `edit` 调用更高效。

4. **工具定义用 Zod schema**
   ```typescript
   const readTool = Tool.define({
     name: "read",
     inputSchema: z.object({
       file_path: z.string().describe("文件路径"),
       offset: z.number().optional().describe("起始行"),
       limit: z.number().optional().describe("读取行数"),
     }),
     async execute(args, ctx) { ... }
   })
   ```
   Zod 同时提供：TypeScript 类型推断 + JSON Schema 生成 + 运行时校验。

### 对比其他 Agent

| Agent | 文件工具设计 | 特点 |
|-------|------------|------|
| **OpenCode** | read/write/edit/patch | LSP 增强 read、search/replace 编辑 |
| **Claude Code** | View/Write/Edit | 与 OpenCode 类似 |
| **Aider** | 自动编辑，无显式工具选择 | 模型决定编辑位置，Aider 处理 |
| **Cursor** | Apply Edit | IDE 集成、实时预览 |

### 关键洞察

文件工具看起来简单，但设计中有几个容易被忽视的细节：

- **大文件处理**：`offset`/`limit` 避免把 10000 行文件整个塞入上下文
- **编辑失败处理**：`old_str` 找不到怎么办？重试？报错？——直接影响 Agent 可靠性
- **编码问题**：UTF-8、BOM、换行符差异（CRLF vs LF）可能导致"看起来一样但匹配失败"
- **原子性**：`write` 覆盖整个文件是原子的，`edit` 部分修改不是——如果 Agent 做 10 次 `edit`，第 5 次失败了，前 4 次的影响已经留下

**下一步**：文件工具让 Agent 能读写了，但还找不到文件。Stage 06 会加入搜索工具。