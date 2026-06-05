## MODIFIED Requirements

### Requirement: LLM API 封装发送聊天补全请求
系统 SHALL 提供一个封装 Chat Completion API 调用的模块，接收消息列表并返回模型响应。该模块同时支持非流式（`chat()`）和流式（`streamChat()`）两种调用模式。

#### Scenario: 成功调用 API 并返回响应内容
- **WHEN** 调用 `chat()` 函数并传入至少包含一条用户消息的消息列表
- **THEN** 函数 SHALL 向配置的 Chat Completion 端点发送 POST 请求
- **AND** 返回 `choices[0].message.content` 中的模型响应文本

#### Scenario: 成功发起流式请求并逐块产出内容
- **WHEN** 调用 `streamChat()` 函数并传入至少包含一条用户消息的消息列表
- **THEN** 函数 SHALL 向配置的 Chat Completion 端点发送带 `stream: true` 的 POST 请求
- **AND** 返回一个 AsyncGenerator，调用方可通过 `for await...of` 逐块获取 delta content 字符串

#### Scenario: 从环境变量读取配置
- **WHEN** 模块初始化 API 客户端
- **THEN** 它 SHALL 从 `OPENAI_API_KEY` 环境变量读取 API Key
- **AND** 从 `OPENAI_MODEL` 环境变量读取模型名称
- **AND** 从 `OPENAI_BASE_URL` 环境变量读取基础 URL（如已设置）

#### Scenario: 非流式 API 错误向调用方抛出
- **WHEN** 非流式 API 返回错误响应（4xx 或 5xx）
- **THEN** `chat()` 函数 SHALL 抛出一个包含失败描述的错误

#### Scenario: 流式 API 错误向调用方抛出
- **WHEN** 流式 HTTP 请求返回非 2xx 状态码
- **THEN** `streamChat()` 函数 SHALL 抛出一个包含状态码和错误描述的错误
