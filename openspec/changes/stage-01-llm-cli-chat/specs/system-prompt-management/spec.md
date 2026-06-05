## 新增需求

### Requirement: 按名称加载 System Prompt
系统 SHALL 提供一个管理 system prompt 模板的模块，允许调用方通过命名键选择 prompt。

#### Scenario: 未指定名称时返回默认 prompt
- **WHEN** 调用 `getSystemPrompt()` 函数且不传入参数
- **THEN** 函数 SHALL 返回默认的 system prompt 字符串

#### Scenario: 传入有效名称时返回对应 prompt
- **WHEN** 调用 `getSystemPrompt("code-assistant")` 函数
- **THEN** 函数 SHALL 返回与键 `code-assistant` 关联的 system prompt

#### Scenario: 未知名称回退到默认 prompt
- **WHEN** 调用 `getSystemPrompt()` 函数并传入未识别的名称
- **THEN** 函数 SHALL 返回默认 system prompt 并输出警告日志
