## 新增需求

### Requirement: LLM API 封装发送聊天补全请求
系统 SHALL 提供一个封装 Chat Completion API 调用的模块，接收消息列表并返回模型响应。

#### Scenario: 成功调用 API 并返回响应内容
- **WHEN** 调用 `chat()` 函数并传入至少包含一条用户消息的消息列表
- **THEN** 函数 SHALL 向配置的 Chat Completion 端点发送 POST 请求
- **AND** 返回 `choices[0].message.content` 中的模型响应文本

#### Scenario: 从环境变量读取配置
- **WHEN** 模块初始化 API 客户端
- **THEN** 它 SHALL 从 `OPENAI_API_KEY` 环境变量读取 API Key
- **AND** 从 `OPENAI_MODEL` 环境变量读取模型名称
- **AND** 从 `OPENAI_BASE_URL` 环境变量读取基础 URL（如已设置）

#### Scenario: API 错误向调用方抛出
- **WHEN** API 返回错误响应（4xx 或 5xx）
- **THEN** 函数 SHALL 抛出一个包含失败描述的错误
