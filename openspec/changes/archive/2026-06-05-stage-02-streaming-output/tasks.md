## 1. llm.ts — 实现流式 LLM API 封装

- [x] 1.1 添加 `streamChat()` 函数声明，接收 `ChatMessage[]` 参数，返回 `AsyncGenerator<string>`
- [x] 1.2 使用原生 `fetch` 发起流式 POST 请求，请求体包含 `model`、`messages` 和 `stream: true`
- [x] 1.3 实现 SSE 行缓冲解析：`response.body.getReader()` + `TextDecoder({ stream: true })` + 按 `\n` 分割行
- [x] 1.4 解析每行 `data: ` 前缀：遇到 `[DONE]` 终止迭代，否则 `JSON.parse` 提取 `choices[0].delta.content`
- [x] 1.5 处理异常：非 2xx 响应抛出错误，JSON 解析失败记录警告到 stderr 并继续

## 2. index.ts — 改造 CLI 入口支持流式输出

- [x] 2.1 导入 `streamChat` 替换（或并存）`chat`
- [x] 2.2 使用 `for await (const chunk of streamChat(...))` 循环消费 AsyncGenerator
- [x] 2.3 每个 chunk 通过 `process.stdout.write(chunk)` 立即输出到终端
- [x] 2.4 流式迭代正常结束后输出换行符 `process.stdout.write("\n")`

## 3. 验证

- [x] 3.1 运行 `bun run src/index.ts "你好，世界！"` 验证响应逐字出现在终端
- [x] 3.2 不传参数运行 CLI 验证仍显示使用说明
- [x] 3.3 临时设置无效的 API Key 验证流式模式下仍打印描述性错误信息
