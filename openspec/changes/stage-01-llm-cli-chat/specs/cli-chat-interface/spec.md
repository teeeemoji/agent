## 新增需求

### Requirement: CLI 接收用户输入并打印 LLM 响应
系统 SHALL 提供一个 CLI 入口，接收用户输入，调用 LLM API，并将响应文本打印到标准输出。

#### Scenario: 通过参数输入进行单轮对话
- **WHEN** 用户执行 `bun run src/index.ts "什么是 TypeScript？"`
- **THEN** 系统将用户消息发送给 LLM API
- **AND** 将 LLM 的响应文本打印到标准输出

#### Scenario: 无输入时显示使用说明
- **WHEN** 用户运行 CLI 且未提供任何输入参数
- **THEN** 系统 SHALL 打印使用说明，告知如何提供输入
- **AND** 以非零状态码退出

#### Scenario: API 错误时打印错误信息
- **WHEN** LLM API 调用失败（例如无效的 API Key、网络错误）
- **THEN** 系统 SHALL 将描述性错误信息打印到标准错误输出
- **AND** 以非零状态码退出
