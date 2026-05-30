# Stage 20 — TUI 增强：语法高亮与 Diff 显示

> **承上**：Stage 19 实现了基础 TUI，能显示对话但体验粗糙
> **启下**：代码高亮和 Diff 是编码 Agent TUI 区别于聊天应用的核心特征

---

## 学习目标

1. 掌握终端中的语法高亮实现（Tree-sitter / highlight.js）
2. 理解 unified diff 格式及其终端渲染
3. 理解为什么编码 Agent 的 TUI 需要这些特殊渲染

## 核心概念

### 语法高亮

Agent 输出中的代码块需要用颜色高亮显示，这是编码 Agent TUI 与普通聊天 TUI 的关键差异。

```
普通聊天 TUI 的输出：
  Agent: 好的，这是代码：
  def hello():
      print("hello")

编码 Agent TUI 的输出（带高亮）：
  Agent: 好的，这是代码：
  def hello():          ← def 蓝色，hello() 黄色
      print("hello")    ← print 蓝色，"hello" 绿色
```

### Diff 显示

Agent 执行 `edit` 工具后，在 TUI 中以 diff 格式显示变更：

```
修改前 → 修改后：
  - return x + y         ← 红色，以 - 开头
  + return x + y + z     ← 绿色，以 + 开头
```

### 渲染组件

```
CodeBlock 组件：
  - 检测代码块（```language ... ```）
  - 应用语法高亮
  - 行号显示

DiffBlock 组件：
  - 检测 +/- 行
  - 红色渲染删除行
  - 绿色渲染添加行
  - 上下文行灰色
```

## 产出物

在 Stage 19 基础上：
- `tui/components/code-block.tsx` — 代码块高亮
- `tui/components/diff-block.tsx` — Diff 显示
- `tui/highlighter.ts` — 语法高亮引擎

## 实现要点

- 选择高亮方案：`shiki`（VS Code 同款引擎）或 `highlight.js`
- 代码块检测：正则匹配 markdown 代码块格式
- 终端色支持：检查终端 color depth（true color vs 256 vs 16）
- Diff 渲染：解析 unified diff 格式的行前缀

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 TUI 渲染能力非常专业：

1. **Tree-sitter 语法高亮**
   OpenCode 使用 Tree-sitter（不是 regex-based 高亮器）进行语法高亮：
   - Tree-sitter 是真正的解析器，能准确区分"函数名"和"变量名"
   - 支持 100+ 语言
   - 增量解析，大文件也不卡

2. **CodeRenderable 组件**
   不是简单的"给文本加颜色"：
   ```
   CodeRenderable:
     - Tree-sitter 解析 → 语法树
     - 语法树 → 高亮 token 流
     - Token 流 → ANSI 转义 + cell 矩阵
     - 支持行号、折叠、光标
   ```

3. **DiffRenderable 组件**
   支持两种模式：
   - **Unified Diff**：单栏，`-` 红 `+` 绿
   - **Split Diff**：左右双栏，原版在左，新版在右

4. **终端协议利用**
   OpenCode 充分利用现代终端的协议：
   - **Kitty Keyboard Protocol**：更丰富的按键事件（Ctrl+Shift 组合等）
   - **OSC 52**：剪贴板集成
   - **Synchronized Output**：批量更新，避免撕裂

### 对比其他 Agent

| Agent | 语法高亮 | Diff 显示 | 终端实现 |
|-------|---------|----------|---------|
| **OpenCode** | Tree-sitter (100+ lang) | Unified + Split | OpenTUI 自研 |
| **Claude Code** | 基础高亮 | Unified | Bubbletea |
| **Aider** | 无（纯文本） | 无特定渲染 | 终端直接输出 |
| **Cursor** | VS Code 引擎 | VS Code Diff | VS Code |

### 关键洞察

TUI 中对代码的渲染质量，直接影响用户对 Agent 的**信任感**：

- 如果代码没有高亮，用户需要"仔细看"才能理解 Agent 写了什么——增加了认知负担
- 如果 diff 没有颜色区分，用户难以快速判断 Agent 改了什么——降低了审查效率
- 好的渲染 = 用户能快速验证 Agent 的工作 = 更愿意信任 Agent

这也是 OpenCode 为什么愿意投入巨大精力做 OpenTUI——因为渲染质量是 Agent 可信度的一部分。

**下一步**：TUI 功能完整了。Stage 21 开始多 Agent 系统。