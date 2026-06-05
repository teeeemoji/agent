## 动机

Stage 01 实现的非流式调用中，用户需要等待 3-10 秒才能看到 LLM 的完整回复，期间无任何进度反馈。流式输出（Streaming）不仅能显著改善交互体验，更是后续 Agent 架构中实时检测 tool-call、支持用户中断（Ctrl+C）等核心能力的基础设施。本阶段将在现有代码基础上增加 SSE 流式解析和逐字渲染能力。

## 变更内容

- 在 `llm.ts` 中新增 `streamChat()` 函数，使用原生 `fetch` + `response.body.getReader()` 实现流式读取
- 修改 `index.ts`，增加流式模式下的逐字打印逻辑（可选回退到非流式模式）
- 逐行解析 SSE `data:` chunk，提取 `choices[0].delta.content` 并立即输出
- 正确处理 `[DONE]` 结束信号和错误场景
- 保留现有 `chat()` 函数作为非流式回退选项

## 能力

### 新增能力

- `streaming-llm-api`：基于 SSE 协议的流式 LLM API 调用封装，负责发起流式请求、逐块读取响应体、解析 SSE 数据行、提取 delta content，并正确处理结束信号和异常。
- `streaming-cli-output`：流式输出到终端的逐字渲染逻辑，将 delta content 实时写入 stdout，在收到 `[DONE]` 后输出换行，在错误时输出错误信息。

### 修改的能力

- `llm-api-wrapper`：在现有非流式 `chat()` 函数旁边新增 `streamChat()` 函数，两者共享相同的模型/端点配置，但走不同的请求路径（`stream: true`）。
- `cli-chat-interface`：修改 `index.ts` 中的 main 函数，默认使用流式调用，将 `chat()` 替换为 `streamChat()` 获得逐字输出体验。

## 影响范围

- **修改文件**：`miniagent/src/llm.ts`、`miniagent/src/index.ts`
- **依赖**：无新增 npm 依赖，使用 Node.js 内置 `fetch` API（Node 18+）和 `ReadableStream`
- **破坏性变更**：无 —— 流式模式为默认行为，但对外接口保持向后兼容
