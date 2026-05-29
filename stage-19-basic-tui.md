# Stage 19 — 基础 TUI（Terminal User Interface）

> **承上**：Stage 17-18 完成了 Server，但 CLI Client 还很简陋
> **启下**：TUI 是 OpenCode 的核心体验，Stage 20 会加入语法高亮和 Diff 显示

---

## 学习目标

1. 理解 TUI 框架的选择和基本概念（组件、渲染、事件循环）
2. 掌握 TUI 中实时显示 Agent 输出的模式
3. 理解 TUI 与 SSE 事件流的协作方式

## 核心概念

### TUI 架构

```
TUI Client (进程)
  ├── SSE Client ──→ 接收 Agent 事件流
  ├── Component Tree ──→ 渲染 UI
  ├── Key Handler ──→ 处理用户输入
  └── HTTP Client ──→ 发送消息到 Server
```

### 布局设计

```
┌─────────────────────────────────────────────┐
│ Session: Fix auth bug         Agent: Build  │ ← Header
├─────────────────────────────────────────────┤
│                                             │
│  User: 请修复 auth.ts 里的登录 bug           │
│                                             │
│  Agent: 我来看看...                          │
│     [read] src/auth.ts                      │
│     [read] ✓ 读取成功                        │
│     ...                                     │  ← 对话区域（可滚动）
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│ > 请添加单元测试                              │ ← 输入区域
└─────────────────────────────────────────────┘
```

## 产出物

在 Stage 18 基础上：
- `tui/app.tsx` — TUI 主应用
- `tui/components/chat-view.tsx` — 对话视图
- `tui/components/input-bar.tsx` — 输入栏
- `tui/components/status-bar.tsx` — 状态栏
- `tui/sse-client.ts` — SSE 事件接收

## 实现要点

- 选择 TUI 框架：推荐 `blessed` / `neo-blessed` (Node.js) 或 `ink` (React for terminal)
- 对话区域支持滚动
- 输入栏支持多行输入、发送（Enter）
- 状态栏显示当前 session、Agent 名称
- 实时接收 SSE 事件并更新 UI

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 TUI 远比其他 Agent 复杂——他们自己写了一个 TUI 框架（**OpenTUI**）：

1. **为什么自研框架？**
   现存的 TUI 框架（Ink, Bubbletea）无法达到 60 FPS 的性能——同时处理流式输出、滚动、语法高亮、Diff 显示时，帧率会降。

2. **Zig + SolidJS 两层架构**
   ```
   TypeScript 层 (Bun)    — SolidJS 组件、Yoga 布局、业务逻辑
   Zig 层 (Native FFI)    — 帧差分、ANSI 生成、Rope 缓冲
   ```

3. **60 FPS 的关键技术**
   - **帧差分（Frame Diffing）**：不每次重绘整个屏幕，只输出变化的部分
   - **Rope 数据结构**：大文本的插入删除 O(log n) 而非 O(n)
   - **RLE 压缩**：相同样式的连续 cell 压缩为一个 ANSI 转义序列

4. **声明式 UI**
   使用 SolidJS 的细粒度响应性。状态变化 → 自动重新渲染。
   ```tsx
   <Box border="single" title="Chat">
     <ScrollBox>
       {messages().map(msg => <MessageRenderable message={msg} />)}
     </ScrollBox>
   </Box>
   ```

### 对比其他 Agent

| Agent | TUI 框架 | 性能 | 复杂度 |
|-------|---------|------|--------|
| **OpenCode** | OpenTUI (Zig+SolidJS) 自研 | 60 FPS | 极高 |
| **Claude Code** | Bubbletea (Go) | 中 | 中 |
| **Aider** | 无 TUI（纯文本 CLI） | — | 低 |
| **LangChain CLI** | Rich (Python) | 低 | 低 |

### 关键洞察

TUI 框架的选择是 OpenCode 最"激进"的技术决策。自研 TUI 框架的投入极大（Zig FFI + 自研 reconciler + 6 平台变体），但收益也很大——60 FPS 的流畅体验让 OpenCode 的终端交互体验远超同类工具。

对于学习项目，我们不需要（也不应该）自研 TUI 框架。用 Ink 或 Blessed 就足够了。重点是理解 TUI 如何与 Agent Server 协作：**TUI Client 只是一个 SSE 事件的消费者**，UI 框架可以随时替换。

**下一步**：基础 TUI 能显示对话了。Stage 20 加入语法高亮和 Diff 对比。