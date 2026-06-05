## Purpose

TBD - 流式 LLM API：基于 SSE 协议实现流式 Chat Completion API 调用。

## Requirements

### Requirement: 流式 LLM API 调用
系统 SHALL 提供一个基于 SSE 协议的流式 Chat Completion API 调用函数 `streamChat()`，使用原生 `fetch` 发起流式请求并返回 AsyncGenerator，逐块产出 delta content 字符串。

#### Scenario: 成功发起流式请求并逐块产出内容
- **WHEN** 调用 `streamChat()` 并传入至少包含一条用户消息的消息列表
- **THEN** 函数 SHALL 向配置的 Chat Completion 端点发送带 `stream: true` 的 POST 请求
- **AND** 返回一个 AsyncGenerator，调用方可通过 `for await...of` 逐块获取 `choices[0].delta.content` 字符串

#### Scenario: 正确处理 [DONE] 结束信号
- **WHEN** SSE 流返回 `data: [DONE]` 行
- **THEN** AsyncGenerator SHALL 正常结束迭代，不再产出新的 chunk

#### Scenario: SSE 数据行跨 chunk 分割
- **WHEN** 网络传输的 chunk 边界落在某条 SSE 数据行中间
- **THEN** 解析器 SHALL 将不完整的行缓冲到下一次读取
- **AND** 只在收到完整行时才进行解析

#### Scenario: 流式请求失败时抛出错误
- **WHEN** 流式 HTTP 请求返回非 2xx 状态码
- **THEN** 函数 SHALL 抛出一个包含状态码和错误描述的错误

#### Scenario: chunk 解析失败时记录警告并继续
- **WHEN** 某个 SSE 数据行的 JSON 解析失败（非 `[DONE]` 行）
- **THEN** 函数 SHALL 在 stderr 输出警告信息
- **AND** 继续处理后续 chunk，不中断整个流

#### Scenario: 无内容的 delta chunk 被跳过
- **WHEN** 某个 chunk 的 `choices[0].delta.content` 为 `undefined` 或空字符串
- **THEN** 该 chunk SHALL 被跳过，不产出给调用方
