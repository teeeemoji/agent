# Stage 30 — Desktop 应用（Tauri）

> **承上**：Stage 29 的 Web UI 在浏览器中，Desktop 应用带来原生体验
> **启下**：Desktop 是第三个客户端，证明架构可以无限扩展

---

## 学习目标

1. 理解 Tauri 的基本原理——Rust 后端 + Web 前端 = 桌面应用
2. 掌握如何将 Web UI 包装为桌面应用
3. 理解桌面应用的特殊能力（系统托盘、文件系统访问、自动更新）

## 核心概念

### Tauri 架构

```
Tauri Desktop App
  ├── Rust Core（系统级能力）
  │   ├── 窗口管理
  │   ├── 系统托盘
  │   ├── 文件对话框
  │   ├── 自动更新
  │   ├── 快捷键注册
  │   └── 本地 HTTP Server 启动
  │
  └── Web Frontend（Stage 29 的 Web UI）
      ├── SSE Client
      └── HTTP Client
```

### 为什么要有 Desktop

| 能力 | Web UI | Desktop (Tauri) |
|------|--------|-----------------|
| 浏览器限制 | ✅ 必须用浏览器 | ❌ 独立窗口 |
| 文件系统 | ⚠️ 有限访问 | ✅ 完全访问 |
| 系统托盘 | ❌ | ✅ |
| 全局快捷键 | ❌ | ✅ |
| 自动更新 | ❌ | ✅ |
| 离线使用 | ⚠️ | ✅ |
| Server 管理 | ❌ | ✅ (自动启停) |

### Desktop 自动管理 Server

```
用户打开 Desktop App
  → Tauri 自动启动 OpenCode Server（子进程）
  → Web UI 连接 localhost:PORT
  → 用户关闭 App
  → Tauri 自动关闭 Server
```

## 产出物

在 Stage 29 基础上：
- `desktop/src-tauri/` — Tauri Rust 后端
- `desktop/src-tauri/main.rs` — Tauri 入口
- `desktop/src-tauri/server-manager.rs` — Server 生命周期管理
- 将 Web UI 作为桌面应用的前端

## 实现要点

- 使用 `create-tauri-app` 初始化项目
- Rust 侧：启动 Server 子进程、窗口控制、系统托盘
- Tauri 的 `invoke` 命令调用 Rust 函数（如 `start_server`, `stop_server`）
- 将 Stage 29 的 Web UI 作为 Tauri 的 WebView 内容
- 配置 Tauri 的窗口大小、标题、图标

---

## 技术洞察

### OpenCode 的做法

OpenCode 的 Desktop 应用使用 Tauri，技术选型很务实：

1. **Web 前端复用**
   Desktop 的前端和 Web UI 共享代码——Tauri 本质上是一个"带原生壳的 WebView"。

2. **Server 管理**
   Desktop App 启动时自动管理 OpenCode Server 的生命周期。

3. **原生能力补充**
   - 系统托盘显示 Agent 状态
   - 全局快捷键（Cmd+Shift+O 打开 OpenCode）
   - 文件拖拽到窗口

### 对比其他 Agent

| Agent | Desktop | 框架 | 特点 |
|-------|---------|------|------|
| **OpenCode** | ✅ Tauri | Tauri (Rust + Web) | 轻量、跨平台 |
| **Claude Code** | ❌ | — | — |
| **Aider** | ❌ | — | — |
| **Cursor** | ✅ Electron | Electron | 重量级、IDE 级 |
| **ChatGPT** | ✅ Electron | Electron | 平台绑定 |

### 关键洞察

Desktop 应用在这个学习项目中的价值，和 Web UI 一样——**验证架构**：

- 同样的 Server API
- 同样的 SSE 事件流
- 同样的 Web 前端代码
- 只是多了一个 Tauri 的 Rust 壳

这说明 OpenCode 的 Client/Server 架构设计是正确的：**Server 是稳定的核心，Client 是可替换的外壳**。从 TUI 到 Web UI 到 Desktop App，Server 层不需要做任何改变。

**下一步**：Desktop 完成了。Stage 31 处理可靠性——错误恢复与重试。