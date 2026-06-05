## ADDED Requirements

### Requirement: 流式输出逐字渲染到终端
系统 SHALL 在 CLI 模式下将 LLM 的流式响应的每个 delta content 块立即打印到标准输出，实现逐字（逐 token）显示效果。

#### Scenario: 流式模式下逐块输出内容
- **WHEN** CLI 以默认（流式）模式运行
- **THEN** 系统 SHALL 对 `streamChat()` 返回的每个 chunk 立即调用 `process.stdout.write(chunk)` 输出
- **AND** 用户 SHALL 看到内容逐字出现在终端上

#### Scenario: 流式结束后输出换行
- **WHEN** 流式 AsyncGenerator 正常结束（收到 `[DONE]`）
- **THEN** 系统 SHALL 在最后输出一个换行符 `\n`

#### Scenario: 流式请求失败时打印错误信息
- **WHEN** `streamChat()` 抛出异常（如网络错误、认证失败）
- **THEN** 系统 SHALL 将错误信息打印到标准错误输出
- **AND** 以非零状态码退出

#### Scenario: 无输入时仍显示使用说明
- **WHEN** 用户运行 CLI 且未提供任何输入参数（无论流式或非流式模式）
- **THEN** 系统 SHALL 打印使用说明
- **AND** 以非零状态码退出
