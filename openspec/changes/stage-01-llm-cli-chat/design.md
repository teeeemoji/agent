## 背景

这是多阶段 AI 编程助手项目的第 01 阶段，旨在循序渐进地教授 AI Agent 架构。项目从零开始，没有任何既有代码。目标是构建一个最小的 CLI 工具：接收用户输入 → 发送给 LLM API → 打印响应 —— 这是 LLM 驱动应用的最简形态。

运行时选用 Node.js 或 Bun，LLM 提供方使用 OpenAI 兼容的 Chat Completion API，配置通过 `.env` 文件管理。

## 目标 / 非目标

**目标：**
- 提供一个可工作的 CLI 命令，接收用户输入并返回 LLM 输出
- 将 LLM API 调用逻辑封装为可复用模块
- 支持可配置的 system prompt 来影响 LLM 行为
- 保持架构简单、模块化，便于后续阶段扩展

**非目标：**
- 不实现流式输出（推迟到 Stage 02）
- 不实现多轮对话循环（推迟到 Stage 03）
- 不实现工具调用或 Agent 循环（推迟到 Stage 04 及之后）
- 不实现 .env 之外的认证方式
- 不实现富文本 TUI 或 UI 框架（纯终端 I/O）

## 决策

### 运行时：优先 Bun，兼容 Node.js

项目以 Bun 为主要运行时，利用其快速启动和原生 TypeScript 支持的优势。同时所有代码保持与 Node.js + `tsx` 兼容以增加灵活性。`package.json` 中同时提供两种运行时的脚本。

**备选方案：**
- 纯 Node.js + `tsx`：可用但启动较慢，配置较多
- Deno：TypeScript 支持好但生态成熟度较低

### 语言：TypeScript

TypeScript 提供类型安全和更好的 IDE 支持，随着代码库扩展到 30+ 个阶段，这一点至关重要。配置保持精简：`tsconfig.json` 启用 `strict: true`。

### LLM 客户端：`openai` SDK

使用官方 `openai` npm 包提供经过充分测试的 Chat Completion API 客户端，内置 HTTP 连接管理、重试和（后续阶段所需的）流式传输支持。

**备选方案：**
- 原生 `fetch` 调用：更灵活但代码量更大，缺少内置重试和流式支持
- `@anthropic-ai/sdk`：不与 OpenAI 兼容，限制了提供方选择

### 输入方式：命令行参数（后续可斟酌 stdin 回退）

Stage 01 中，用户通过命令行参数提供输入：`bun run src/index.ts "什么是 TypeScript？"`，保持 CLI 简洁。后续可增加 stdin 读取作为回退。

### System Prompt：静态文件 + 模板支持

`prompts.ts` 模块导出 system prompt 字符串，可通过命名键选择不同 prompt。既能展示概念，又不会过度设计 —— 动态 prompt 构建留待后续阶段。

### 错误处理：快速失败 + 描述性信息

API 错误（网络问题、错误的 API Key、速率限制）被捕获并以清晰的终端消息报告。失败时程序以非零状态码退出。

## 风险 / 权衡

- **API Key 泄露风险**：`.env` 文件可能被意外提交。缓解措施：`.gitignore` 包含 `.env`，`.env.example` 记录必需的环境变量
- **模型名称硬编码**：模型在 `.env` 中指定，但不同提供方的模型名称可能不兼容。缓解措施：在 `.env.example` 中做好说明
- **无重试逻辑**：网络失败直接终止程序。Stage 01 可接受 —— 重试逻辑增加复杂度，更适合推迟到错误处理阶段（Stage 31）
