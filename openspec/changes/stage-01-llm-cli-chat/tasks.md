## 1. 项目脚手架

- [x] 1.1 创建 `miniagent/` 目录结构，包含 `src/` 子目录
- [x] 1.2 创建 `package.json`，配置项目元信息、`openai` 和 `dotenv` 依赖，以及 `bun run` / `tsx` 脚本
- [x] 1.3 创建 `tsconfig.json`，配置 `strict: true`、`module: "ESNext"`、`target: "ESNext"`

## 2. 环境配置

- [x] 2.1 创建 `.env` 文件，包含 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` 变量
- [x] 2.2 创建 `.env.example` 文件，记录所有必需和可选变量及其说明
- [x] 2.3 确保 `.env` 已在 `.gitignore` 中

## 3. System Prompt 管理

- [x] 3.1 实现 `src/prompts.ts`，至少包含两个 system prompt：默认编程助手 prompt 和一个备用 prompt（如通用助手）
- [x] 3.2 导出 `getSystemPrompt(name?: string): string` —— 按名称返回 prompt，未识别的名称回退到默认值

## 4. LLM API 封装

- [x] 4.1 使用 `openai` SDK 实现 `src/llm.ts`，从环境变量读取 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL`
- [x] 4.2 导出 `chat(messages: ChatMessage[]): Promise<string>` —— 发送消息到 Chat Completion API 并返回模型响应文本
- [x] 4.3 处理 API 错误，抛出包含状态码和错误信息的描述性异常

## 5. CLI 入口

- [x] 5.1 实现 `src/index.ts` —— 加载 `.env`，从 `process.argv` 读取用户输入，调用 `chat()` 传入 system + user 消息，打印响应
- [x] 5.2 处理无输入情况：打印使用说明到 stderr 并以状态码 1 退出
- [x] 5.3 处理 API 错误：打印错误信息到 stderr 并以状态码 1 退出
- [x] 5.4 使用 `prompts.ts` 中的 system prompt 作为 API 调用的 system 消息

## 6. 验证

- [x] 6.1 运行 `bun run src/index.ts "你好，世界！"` 验证打印非空响应
- [x] 6.2 不传参数运行 CLI 验证显示使用说明
- [x] 6.3 临时设置无效的 API Key 验证打印描述性错误信息
