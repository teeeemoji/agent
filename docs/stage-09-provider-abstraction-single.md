# Stage 09 — Provider 抽象层（单 Provider）

> **承上**：前 8 个 Stage 的 LLM 调用是硬编码的
> **启下**：抽象 Provider 层是支持多模型的基础，也是系统解耦的关键

---

## 学习目标

1. 理解 Provider 抽象层的设计——接口定义与实现分离
2. 掌握将 LLM 调用从 Agent Loop 中解耦出来
3. 认识"针对接口编程"在 Agent 系统中的价值

## 核心概念

### 抽象层设计

```
Agent Loop  ──→  Provider Interface  ←──  Concrete Provider
（不关心调用细节）    │                     （处理认证、格式、重试）
                  ├── chat(messages) → response
                  ├── streamChat(messages) → stream
                  └── listModels() → model[]
```

### 为什么需要抽象层

1. Agent Loop 不应该知道模型是 OpenAI 还是 Anthropic
2. 切换模型不应该修改 Agent 核心代码
3. 不同的 Provider 有不同的：API 格式、认证方式、错误处理

## 产出物

在 Stage 08 基础上：
- `provider/types.ts` — Provider 接口定义
- `provider/openai-provider.ts` — OpenAI 实现
- `provider/provider-factory.ts` — Provider 工厂
- 修改 `agent-loop.ts` 通过 Provider 接口调用 LLM
- 新增 `.miniagent/config.json` 配置 provider

## 实现要点

- 定义 `IProvider` 接口
- 提取公共逻辑（消息格式化、stream 解析）到基类或工具函数
- 认证信息从环境变量读取
- 错误处理：区分网络错误 vs API 错误 vs 速率限制

---

## 技术洞察

### OpenCode 的做法

OpenCode 基于 Vercel AI SDK 构建 Provider 层，并自研了 `ProviderTransform` 体系：

```
Provider 抽象层 = AI SDK (统一接口) + ProviderTransform (差异吸收)
```

AI SDK 提供了 `generateText()` / `streamText()` 的统一接口。但不同 Provider 的 API 有细微差异，OpenCode 的 `ProviderTransform` 负责处理：

| 差异类型 | 处理方式 |
|---------|---------|
| Anthropic 不接受空 content | 过滤掉空内容 |
| Mistral tool call ID 格式 | 规范化为 9 位字母数字 |
| 各 Provider 缓存机制不同 | 分别处理缓存控制头 |
| 各 Provider 支持不同的 maxTokens | 按模型能力调整 |

### 对比其他 Agent

| Agent | Provider 层 | 实现 |
|-------|------------|------|
| **OpenCode** | AI SDK + ProviderTransform | 统一接口 + 差异补丁 |
| **Claude Code** | 无需（只调 Claude API） | 直接调 HTTP |
| **Aider** | LiteLLM 代理 | 中间层统一 |
| **LangChain** | BaseChatModel 子类 | 每个 Provider 写一个类 |

### 关键洞察

Provider 抽象层的好坏决定了 Agent 的**模型自由度**：

- **没有抽象层** = 换模型就要改 Agent 核心代码（像 Claude Code）
- **简单抽象层** = 统一接口但 Provider 差异会泄漏到上层（像 LangChain 早期版本）
- **OpenCode 的方案** = AI SDK 统一接口 + ProviderTransform 吸收差异 = 最优解

ProviderTransform 的设计哲学很值得学：**不要把每个 Provider 的差异都封装到一个 if-else 里，而是用声明式的 transform 管道**。这符合 Unix 哲学：每个 transform 做一件事，做好它。

**下一步**：扩展到多 Provider 支持，让不同 Agent 使用不同模型。