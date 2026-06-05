## 背景

Stage 01 使用 OpenAI SDK 的 `client.chat.completions.create()` 进行非流式调用。LLM 在服务端完整生成回复后一次性返回，客户端在此期间没有任何输出。Stage 02 需要改造调用路径，支持 SSE（Server-Sent Events）流式协议，实现逐 token 的增量输出。

当前 `llm.ts` 使用 OpenAI SDK 客户端，`index.ts` 直接调用 `chat()` 获取完整响应后一次性写入 stdout。改造需保持最小侵入性，尽可能复用现有配置。

## 目标 / 非目标

**目标：**
- 新增 `streamChat()` 函数，返回 AsyncGenerator，逐块产出 delta content
- 修改 `index.ts` 默认使用流式调用，实现逐字渲染到终端
- 保留 `chat()` 作为非流式回退，不影响已有 API 兼容性
- 正确处理 SSE 结束信号（`[DONE]`）和中间错误

**非目标：**
- 不引入 Web Streams API 之外的流式抽象层（如 RxJS、Node.js streams）
- 不实现多客户端 SSE 广播（那是 Stage 16-18 的事）
- 不在本阶段检测 tool-call（那是 Stage 04+ 的事）
- 不实现取消/中断流式请求（留待后续阶段）

## 决策

### 流式客户端：原生 `fetch` 而非 OpenAI SDK 的 streaming

OpenAI SDK 的 `stream: true` 模式同样返回 AsyncIterator，但底层依赖 `openai` 库的流式解析器。使用原生 `fetch` 的好处：

- **零新增依赖**：Node.js 18+ 内置 fetch，Bun 也支持
- **学习目的**：直接展示 SSE 协议的实际结构，理解 `data:` 行格式和 `[DONE]` 信号
- **可控性**：细粒度控制 chunk 解析，对后续 Stage（tool-call 的增量解析）更有参考价值

**备选方案：**
- 继续用 OpenAI SDK `stream: true`：更简短的代码，但隐藏了 SSE 细节，学习价值低
- 使用 `eventsource` 或专用 SSE 库：新增依赖，过度设计

### SSE 解析策略：逐行解析 + TextDecoder

`response.body.getReader()` 返回 `Uint8Array` 块，使用 `TextDecoder` 解码。由于网络传输的 chunk 边界可以落在任何位置，需要在 JavaScript 层面实现行缓冲：
1. 读取 chunk → 解码为文本 → 追加到缓冲区
2. 按 `\n` 分割缓冲区，最后不完整行保留在缓冲区
3. 每行检查是否以 `data: ` 开头
4. 如果内容等于 `[DONE]`，停止迭代
5. 否则 JSON.parse 提取 `choices[0].delta.content`

### 渲染策略：直接 `process.stdout.write`

逐字（实际是逐 token/chunk）写入 stdout，无缓冲逐字输出。不使用 console.log（会追加换行），不使用任何 TUI 框架（保持终端原生体验）。

### 错误处理：流中错误 vs 请求错误

- **请求失败**（如 401/403/网络错误）：在 `streamChat()` 中抛出异常，由 `index.ts` 的 catch 块处理
- **流中错误**（如 chunk 解析失败）：记录警告但继续处理后续 chunk，不中断整个流

### `ChatMessage` 类型保持共享

`streamChat()` 和 `chat()` 共用 `ChatMessage` 接口，但 `streamChat()` 额外支持 `ChatCompletionMessageParam` 中的 `content: string | null` 以兼容 OpenAI 类型系统。

## 风险 / 权衡

- **SSE chunk 跨行分割**：网络包的 chunk 边界可能落在 SSE 数据行的中间，导致某次读取只能获取半个 `data:` 行。缓解措施：实现行缓冲区，将不完整的最后一行保留到下一次读取
- **Unicode 多字节字符分割**：UTF-8 多字节字符（如中文）可能被 chunk 边界切断。缓解措施：使用 `TextDecoder` 的 `{ stream: true }` 选项，让解码器自动处理
- **无流式中断支持**：本阶段不实现 AbortController，一旦开始流式就无法中途取消。Stage 31（错误恢复）阶段会补充
- **终端换行行为**：`process.stdout.write` 不会自动追加换行，需在流式结束后手动输出 `\n`

## 迁移计划

1. 在 `llm.ts` 中添加 `streamChat()` 函数后即可使用，无需修改 `chat()`
2. `index.ts` 将 `chat()` 调用替换为 `streamChat()` + `for await` 循环
3. 保留 `chat()` 导入（不删除），便于需要非流式效果的场景回退
4. 运行 `bun run src/index.ts "你的问题"` 验证流式输出效果
