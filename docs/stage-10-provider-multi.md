# Stage 10 — 多 Provider 支持与模型路由

> **承上**：Stage 09 实现了 Provider 抽象层，但只有一个 Provider
> **启下**：多 Provider 支持是 OpenCode 的核心竞争力，为 Stage 21 的多 Agent 不同模型铺路

---

## 学习目标

1. 理解 Provider 解析链（按优先级从高到低选择 Provider）
2. 掌握多 Provider 的认证管理
3. 理解 ProviderTransform 的设计——吸收各 Provider 的 API 差异

## 核心概念

### Provider 解析链

当 Agent 需要一个模型时，按以下优先级解析：

```
1. 任务级显式指定   — "这次用 claude-sonnet"
2. Agent 级默认      — "Build Agent 用 gpt-4o"
3. 项目级配置        — opencode.json 的 provider 段
4. 用户全局配置       — ~/.config/default-model
5. 系统默认           — 硬编码的默认模型
```

### 认证信息的多来源

```
1. 环境变量           — ANTHROPIC_API_KEY
2. 认证文件           — ~/.local/share/opencode/auth.json
3. 配置文件           — opencode.json 的 provider 段
```

### ProviderTransform

每个 Provider 的 API 有细微差异，通过 transform 管道统一处理：

```
Message → [ProviderTransform A] → [ProviderTransform B] → LLM API
          (Anthropic: 去空content) (Cache: 加缓存控制头)
```

## 产出物

在 Stage 09 基础上：
- `provider/anthropic-provider.ts` — Anthropic Claude 实现
- `provider/provider-resolver.ts` — Provider 解析链
- `provider/provider-transform.ts` — 差异化处理
- `provider/auth-manager.ts` — 认证管理
- 支持在配置中指定 `provider/model_id`

## 实现要点

- 每个 Provider 实现相同的 `IProvider` 接口
- 实现 ProviderTransform：空内容过滤、ID 格式化
- Provider Resolver 按优先级链式查找
- 测试：同一段代码，切换 Provider 后行为一致

---

## 技术洞察

### OpenCode 的做法

OpenCode 支持 75+ Providers，核心设计：

1. **`provider/model_id` 格式**
   ```
   anthropic/claude-sonnet-4-20250514
   openai/gpt-4o
   google/gemini-2.5-pro
   ```
   统一标识符，用户只需改配置中的一个字符串。

2. **认证方式多样**
   | 方式 | 对应 Provider |
   |------|--------------|
   | API Key | OpenAI, Anthropic, Google, DeepSeek |
   | OAuth | GitHub Copilot, GitLab Duo, Claude Pro/Max |
   | Cloud Credentials | AWS Bedrock, Google Vertex AI |
   | 无认证 | Ollama, LM Studio, vLLM (本地) |

3. **不同 Agent 不同模型**
   Build Agent 用 claude-sonnet（擅长编码）
   Plan Agent 用 gpt-4o（擅长分析）
   Compaction Agent 用便宜的 haiku（只做压缩）

### 对比其他 Agent

| Agent | 多 Provider | Provider 切换 | Agent 级路由 |
|-------|------------|-------------|------------|
| **OpenCode** | ✅ 75+ | 配置即切换 | ✅ 不同 Agent 不同模型 |
| **Claude Code** | ❌ | 不可切换 | N/A |
| **Aider** | ✅ 多种 | 配置切换 | ❌ |
| **LangChain** | ✅ 多种 | 代码切换 | 需自定义 |

### 关键洞察

多 Provider 支持不是简单的"多写几个 API 适配器"：

1. **Provider 的行为差异**：同一个 prompt，GPT-4o 可能调用 tool A，Claude 调用 tool B。Agent Loop 要有容错能力。
2. **Provider 的价格差异**：给 Compaction Agent 用便宜的模型，给主 Build Agent 用最贵的——这种"模型分层"让总成本可控。
3. **认证安全**：多 Provider 意味着多套 API key 管理。OpenCode 把认证信息分散到环境变量、auth 文件和配置三个地方，没有统一明文存储。

**下一步**：Provider 层完整了。Stage 11 重新审视消息系统——用多态 Part 替代简单 messages 数组。