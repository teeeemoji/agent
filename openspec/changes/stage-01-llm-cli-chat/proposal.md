## 动机

从零构建一个多阶段 AI 编程助手，需要一个坚实的基础。第一阶段的目标是建立一个最小可运行的 LLM CLI 对话工具 —— 一个单轮对话的命令行程序，接收用户输入，发送给 LLM API，然后打印响应。没有这个起点，后续任何 Agent 功能（工具调用、流式输出、会话管理）都无从谈起。

## 变更内容

- 创建 `miniagent/` 项目骨架，包含 `package.json`、`tsconfig.json`
- 实现 CLI 入口（`src/index.ts`），读取用户输入并打印 LLM 响应
- 实现 LLM API 封装（`src/llm.ts`），使用 OpenAI 兼容协议进行 Chat Completion 调用
- 实现系统提示词管理（`src/prompts.ts`），支持可配置的 system prompt 模板
- 通过 `.env` 文件管理 API Key 和模型端点配置
- 支持单轮对话（一问一答）

## 能力

### 新增能力

- `cli-chat-interface`：CLI 入口，读取用户输入（通过命令行参数）并打印 LLM 文本响应到标准输出
- `llm-api-wrapper`：Chat Completion API 调用封装，处理 HTTP 请求、消息格式、错误处理和响应提取
- `system-prompt-management`：系统提示词模板管理，支持按名称加载不同的 system prompt 并注入到 API 调用中

### 修改的能力

<!-- 无须修改已有能力 —— 这是项目的第一阶段 -->

## 影响范围

- **新项目**：`miniagent/` 目录，使用 TypeScript + Node.js/Bun 运行时
- **依赖**：`openai` SDK、`dotenv` 用于加载 .env
- **不影响现有代码**：纯新项目阶段
